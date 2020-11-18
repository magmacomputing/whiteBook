import { Injectable } from '@angular/core';
import { combineLatest } from 'rxjs';
import { take } from 'rxjs/operators';

import { DBaseModule } from '@dbase/dbase.module';
import { fire } from '@dbase/fire/fire.library';
import { StateService } from '@dbase/state/state.service';
import { attendAction } from '@dbase/state/state.action';
import { sumPayment, sumAttend } from '@dbase/state/state.library';

import { DataService } from '@dbase/data/data.service';
import { STORE, FIELD, BONUS, PLAN, SCHEDULE, COLLECTION, PAYMENT } from '@dbase/data.define';
import type { FireDocument, Attend, Schedule, Payment, Gift, React, Comment } from '@dbase/data.schema';

import { PAY, ATTEND, Chain } from '@service/member/attend.define';
import { calcExpiry } from '@service/member/member.library';
import { MemberService } from '@service/member/member.service';
import { SnackService } from '@service/material/snack.service';

import { getInstant, Instant } from '@library/instant.library';
import { isUndefined, isNumber, isEmpty, nullToZero, isDefined } from '@library/type.library';
import { getPath } from '@library/object.library';
import { asArray } from '@library/array.library';
import { dbg } from '@library/logger.library';

/** Add/Delete to the Attend collection */
@Injectable({ providedIn: DBaseModule })
export class AttendService {
	#dbg = dbg(this, 'AttendService');

	constructor(private member: MemberService, private state: StateService, private data: DataService, private snack: SnackService) { this.#dbg('new'); }

	/** Insert an Attend document, aligned to an active Payment  */
	public setAttend = async (schedule: Schedule, date?: Instant.TYPE) => {
		const creates: FireDocument[] = [];
		const updates: FireDocument[] = [];

		// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
		// if no <date>, then look back up-to 7 days to find when the Scheduled class was last offered.  
		// This presumes that the <key> is from Schedule store (classes), and not Calendar (events)
		if (isUndefined(date))
			date = await this.lkpDate(schedule[FIELD.Key], schedule.location);
		const now = getInstant(date);
		const stamp = now.ts;
		const when = now.format(Instant.FORMAT.yearMonthDay);

		// There is a bit of overlap in these Observables, but they serve different purposes
		let [data, source] = await combineLatest([
			this.state.getAccountData(date),								// get Member's current account details
			this.state.getScheduleData(date, schedule.elect),// get Schedule for this date
		])
			.pipe(take(1))																	// unsubscribe on first-emit
			.toPromise()																		// emit Observable as Promise

		// <schedule> might be from Schedule or Calender store
		const field = schedule[FIELD.Store] === STORE.Schedule
			? FIELD.Id																			// compare requested schedule to timetable's ID
			: FIELD.Key																			// compare requested event to class's Key
		const timetable = source.client.schedule!.find(row => row[field] === schedule[field]);
		if (!timetable)																		// this schedule is not actually offered on this date!
			return this.snack.error(`This schedule item not available today: ${schedule[FIELD.Id]}`);

		// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
		// check we are not re-booking same Class on same Day in same Location at same ScheduleTime
		const bookAttend = await this.data.getStore<Attend>(STORE.Attend, [
			fire.addWhere(FIELD.Uid, data.auth.current!.uid),
			fire.addWhere(`track.${FIELD.Date}`, when),
			fire.addWhere(`timetable.${FIELD.Key}`, schedule[FIELD.Key]),
			fire.addWhere(`timetable.${FIELD.Id}`, schedule[FIELD.Id]),// schedule has <location>, <instructor>, <startTime>
			fire.addWhere('note', schedule[FIELD.Note]),					// a different 'note' will allow us to re-book same Class
		])

		if (bookAttend.length) {													// disallow same Class, same Note
			const noNote = !schedule[FIELD.Note] && bookAttend.some(row => isUndefined(row[FIELD.Note]));
			const isNote = schedule[FIELD.Note] && bookAttend.some(row => row[FIELD.Note] === schedule[FIELD.Note]);
			if (noNote || isNote)
				return this.snack.error(`Already attended ${schedule[FIELD.Key]} on ${now.format(Instant.FORMAT.display)}`);
		}

		// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
		// work out the actual price to charge
		if (isUndefined(timetable.price))
			return this.snack.error(`price: No pricing information for this Plan: ${source.member.plan[0].plan}`);

		if (timetable.bonus?.gift) {
			updates.push(...timetable.bonus.gift);					// batch any Gift updates
			delete timetable.bonus.gift;										// not needed
			delete timetable.bonus.note;										// not needed
			if (isEmpty(timetable.bonus))
				delete timetable.bonus;												// not needed
		}
		if (timetable.bonus?.[FIELD.Id])
			timetable.price!.amount = nullToZero(timetable.bonus.amount);	// override Plan price

		// if the caller provided a schedule.amount, and it is different to the calculated amount!  
		// this is useful for the bulk Migration of attends
		if (isDefined(schedule.amount) && schedule.amount !== timetable.price.amount) {// calculation mis-match
			this.#dbg('bonus: %j', timetable.bonus);
			return this.snack.error(`Price discrepancy: paid ${schedule.amount}, but should be ${timetable.price.amount}`);
		}
		schedule.amount = timetable.price.amount;					// the price to use for this class

		// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
		// loop through Payments to determine which should be <active>
		let active: Payment | undefined;									// Payment[0] is assumed active, by default
		let ctr = 0;																			// prevent endless loop

		while (ctr <= ATTEND.maxPayment) {								// only attempt to match limited number of Payments
			ctr++;																					// increment
			data = sumPayment(data);												// calc Payment summary
			data = sumAttend(data);													// deduct Attends against this Payment
			active = data.account.payment[0];								// current Payment
			const expiry = getPath<number>(active, 'expiry') || Number.MAX_SAFE_INTEGER;

			const tests: boolean[] = [];										// array of test results
			tests[PAY.under_limit] = data.account.attend.length < ATTEND.maxColumn;
			tests[PAY.enough_funds] = schedule.amount <= data.account.summary.funds;
			tests[PAY.not_expired] = now.ts <= expiry;

			if (tests.every(val => val))										// if every test passed ok
				break;																				// we have found a useable Payment

			this.#dbg('limit: %j, %j', tests[PAY.under_limit], data.account.attend.length);
			this.#dbg('funds: %j, %j, %j', tests[PAY.enough_funds], schedule.amount, data.account.summary);
			this.#dbg('expiry: %j, %j, %j', tests[PAY.not_expired], now.ts, expiry);

			// If over-limit (100+ Attends per Payment) but still have sufficient funds to cover this Class price,
			// 	insert an auto-approved $0 Payment (only if the next Attend is earlier than any future Payments)
			if (!tests[PAY.under_limit] && tests[PAY.enough_funds]) {
				if (data.account.payment.length <= 1 || stamp < data.account.payment[1].stamp) {
					const payment = await this.member.setPayment(0, stamp);
					Object.assign(payment.fee[0], { uid: ATTEND.autoApprove, stamp });

					creates.push(payment);											// stack the topUp Payment into the batch
					data.account.payment.splice(1, 0, payment);	// make this the 'next' Payment
				}
			}

			// If there are no future Payments, create a new Payment with the higher of
			// a. the usual topUp amount, or b. the amount needed to cover this Attend
			if (data.account.payment.length <= 1) {
				const gap = schedule.amount - data.account.summary.credit;
				const topUp = Math.max(gap, await this.member.getPayPrice(data));
				const payment = await this.member.setPayment(topUp, stamp);

				creates.push(payment);												// stack the topUp Payment into the batch
				data.account.payment.push(payment);						// make this the 'next' Payment
			}

			const queue = active ? 1 : 0;										// next posi on queue
			const next = data.account.payment[queue];
			if (next && !next.bank) {												// rollover unused funds into next Payment
				data.account.payment[queue].bank = data.account.summary.funds;
				if (active)
					updates.push({ [FIELD.Effect]: stamp, [FIELD.Expire]: stamp, ...active });	// close previous Payment
				if (data.account.summary.funds)
					updates.push({ ...data.account.payment[queue] });	// update the now-Active Payment with <bank>

				if (active)
					data.account.payment = data.account.payment.slice(1);// drop the 1st, now-inactive Payment
				data.account.attend = await this.data.getStore(STORE.Attend, fire.addWhere(`${STORE.Payment}.${FIELD.Id}`, next[FIELD.Id]));
			}

			if (isUndefined(next))
				return this.snack.error('Could not allocate a new Payment');
		}																									// repeat the loop to test if this now-Active Payment is useable
		if (isUndefined(active))
			return this.snack.error('Could not allocate an active Payment');

		const expired = active.fee.find(fee => asArray(fee.note).indexOf('Credit Expired') !== -1);
		const upd: Partial<Payment> = {};									// updates to the Payment
		if (!active[FIELD.Effect])
			upd[FIELD.Effect] = stamp;											// mark Effective on first check-in
		if ((data.account.summary.funds === schedule.amount) && schedule.amount)
			upd[FIELD.Expire] = expired?.stamp ?? stamp;		// mark Expired if no funds (except $0 classes)
		if (!active.expiry && active.fee[0][FIELD.Stamp] && isUndefined(timetable.bonus))	// calc an Expiry for this Payment
			upd.expiry = calcExpiry(active.fee[0][FIELD.Stamp]!, active, data.client);

		if (!isEmpty(upd))																// changes to the active Payment
			updates.push({ ...active, ...upd });						// so, batch the Payment update

		if (data.member.plan[0].plan === PLAN.Intro && (data.account.summary.funds - schedule.amount) <= 0)
			this.member.setPlan(PLAN.Member, stamp + 1);		// auto-bump 'intro' to 'member' Plan

		// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
		// got everything we need; insert an Attend document and update any Payment, Gift, Forum documents

		const attendDoc = {
			[FIELD.Store]: STORE.Attend,
			[FIELD.Stamp]: stamp,														// createDate
			[FIELD.Note]: schedule[FIELD.Note],							// optional 'note'
			timetable: {
				[FIELD.Id]: schedule[FIELD.Id],								// <id> of the Schedule
				[FIELD.Key]: schedule[FIELD.Key],							// the Attend's class
				[FIELD.Store]: schedule[FIELD.Type] === SCHEDULE.Class ? STORE.Schedule : STORE.Calendar,
				[FIELD.Type]: schedule[FIELD.Type],						// the type of Attend ('class', 'event', 'special')
			},
			payment: {
				[FIELD.Id]: active[FIELD.Id],									// <id> of Account's current active document
				amount: schedule.amount,											// calculated price of the Attend
			},
			track: {
				[FIELD.Date]: when,														// yyyymmdd of the Attend
				day: now.dow,																	// day of week
				week: now.format(Instant.FORMAT.yearWeek),		// week-number of year
				month: now.format(Instant.FORMAT.yearMonth),	// month-number of year
			},
			bonus: timetable.bonus,													// <id>/<type>/<count> of Bonus
		} as Attend

		creates.push(attendDoc);						// batch the new Attend
		return this.data.batch(creates, updates, undefined, attendAction.Sync)
			.then(_ => this.member.setAccount(creates, updates, data))
	}

	/** look back up-to seven days to find when className was last scheduled */
	private lkpDate = async (className: string, location?: string, date?: Instant.TYPE) => {
		const timetable = await this.state.getTimetableData(date).toPromise();
		let now = getInstant(date);																// start with date-argument
		let ctr = 0;

		if (!location)
			location = this.state.getDefault(timetable, STORE.Location);

		for (ctr; ctr < 7; ctr++) {
			const classes = timetable.client.schedule!						// loop through schedule
				.filter(row => row.day === now.dow)									// finding a match in 'day'
				.filter(row => row[FIELD.Key] === className)				// and match in 'class'
				.filter(row => row.location === location)						// and match in 'location'
			// .filter(row => row.start === now.format(Instant.FORMAT.HHMI)),	// TODO: match by time, in case offered multiple times in a day

			if (classes.length)																		// is this class offered on this 'day'   
				break;
			now = now.add(-1, 'day');															// else move pointer to previous day
		}

		if (ctr >= 7)																						// cannot find className on timetable
			now = getInstant(date);																	// so default back to today's date	

		return now.ts;																					// timestamp
	}

	/**
	 * Removing Attends is a tricky business...  
	 * it may need to walk back a couple of related Documents.  
	 * Avoid deleting a non-latest Attend,
	 * as this will affect Bonus pricing, Gift tracking, Bank rollovers, etc.
	 */
	public delAttend = async (where: fire.Query["where"]) => {
		const memberUid = fire.addWhere(FIELD.Uid, (await this.data.getUID()));
		const filter = asArray(where);
		if (!filter.map(clause => clause.fieldPath).includes(FIELD.Uid))
			filter.push(memberUid);																// ensure UID is present in where-clause

		const updates: FireDocument[] = [];
		const deletes: FireDocument[] = await this.data.getStore<Attend>(STORE.Attend, filter);

		if (deletes.length === 0) {
			this.#dbg('No items to delete');
			return;
		}

		const payIds = (deletes as Attend[])									// the Payment IDs related to this reversal
			.map(attend => attend.payment[FIELD.Id])
			.distinct();
		const giftIds = (deletes as Attend[])									// the Gift IDs related to this reversal
			.filter(attend => attend.bonus?.[FIELD.Type] === BONUS.Gift)
			.map(row => row.bonus![FIELD.Id])
			.distinct();
		const scheduleIds = (deletes as Attend[])							// the Schedule IDs that may have Forum content
			.map(attend => attend.timetable[FIELD.Id])
			.distinct();
		const dates = (deletes as Attend[])										// the Dates these Attends have Forum content
			.map(attend => attend.track.date)
			.distinct();

		/**
		 * attends:	a	ll the Attends that relate to the payIDs (even those about to be deleted)
		 * payments:	all the Payments related to this Member
		 * gifts:			all the Gifts related to this reversal
		 * forum:			all the Forum content related to this reversal
		 */
		const [attends, payments, gifts, forum] = await Promise.all([
			this.data.getStore<Attend>(STORE.Attend, fire.addWhere(`payment.${FIELD.Id}`, payIds)),
			this.data.getStore<Payment & Chain>(STORE.Payment, memberUid),
			this.data.getStore<Gift>(STORE.Gift, [memberUid, fire.addWhere(FIELD.Id, giftIds)]),
			this.data.getFire<React | Comment>(COLLECTION.Forum, {
				where: [
					memberUid,
					fire.addWhere(FIELD.Type, STORE.Schedule),
					fire.addWhere(FIELD.Key, scheduleIds, '=='),			// TODO: this workaround for FireStore limit
					fire.addWhere('track.date', dates, '=='),					// on number of 'in' clauses in a Query
				]
			}),
		])

		// build a linked-list of Payments
		payments
			.orderBy({ field: FIELD.Stamp, dir: 'desc' }, FIELD.Type)
			.forEach((payment, idx, arr) => {
				payment.chain = {
					parent: idx + 1 < arr.length && arr[idx + 1][FIELD.Id] || undefined,
					child: idx !== 0 && arr[idx - 1][FIELD.Id] || undefined,
					index: idx,
				}
			})

		let pays = attends																			// count the number of Attends per Payment
			.map(row => row.payment[FIELD.Id])
			.reduce((acc, itm) => {
				acc[itm] = nullToZero(acc[itm]) + 1;
				return acc;
			}, {} as Record<any, number>)

		const chg = new Set<string>();
		deletes.forEach(attend => {
			let idx: number;

			if (attend.bonus && attend.bonus[FIELD.Type] === BONUS.Gift) {
				idx = gifts.findIndex(row => row[FIELD.Id] === attend.bonus![FIELD.Id]);
				const gift = gifts[idx];
				if (gift) {
					if (isNumber(gift.count))
						gift.count! -= 1;																// decrement running-total
					if (gift.count === 0)
						gift.count = undefined;													// discard running-total
					if (isNumber(gift[FIELD.Expire]))
						gift[FIELD.Expire] = undefined;									// re-open a Gift
				}
			}

			const payId = attend.payment[FIELD.Id];								// get the Payment id
			idx = payments.findIndex(row => row[FIELD.Id] === payId);
			const payment = payments[idx];
			if (payment) {
				if (isNumber(payment[FIELD.Expire]))
					payment[FIELD.Expire] = undefined;								// re-open a Payment
				pays[payId] -= 1;																		// reduce the number of Attends for this Payment
				if (pays[payId] === 0) {														// no other Attend booked against this Payment
					payment[FIELD.Effect] = undefined;								// so, mark the Payment as not-yet-effective
					payment.bank = undefined;													// TODO: dont clear down Payment, if parent had $0 funds

					chg.add(payId);																		// mark this Payment as 'changed
					const parent = payment.chain!.parent;
					if (parent) {
						payments[idx + 1][FIELD.Expire] = undefined;		// un-expire the parent
						chg.add(payments[idx + 1][FIELD.Id]);						// mark the parent as 'changed'
					}
				}
			}
		})

		deletes.push(...forum);																	// delete Forum content as well
		updates.push(...gifts);																	// batch the updates to Gifts
		updates.push(...payments
			.filter(row => chg.has(row[FIELD.Id]))								// only those that have changed
			.map(row => ({ ...row, chain: undefined }))						// drop the calculated chain
		);

		return this.data.batch(undefined, updates, deletes)
			.then(_ => this.member.updAccount())
	}
}