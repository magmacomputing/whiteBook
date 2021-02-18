import { Injectable } from '@angular/core';
import { combineLatest } from 'rxjs';
import { take } from 'rxjs/operators';

import { DBaseModule } from '@dbase/dbase.module';
import { Fire } from '@dbase/fire/fire.library';
import { StateService } from '@dbase/state/state.service';
import { attendAction } from '@dbase/state/state.action';
import { sumPayment, sumAttend } from '@dbase/state/state.library';

import { DataService } from '@dbase/data/data.service';
import { STORE, FIELD, BONUS, PLAN, SCHEDULE, COLLECTION } from '@dbase/data.define';
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
import { nearAt } from '@library/app.library';

/** Add/Delete to the Attend collection */
@Injectable({ providedIn: DBaseModule })
export class AttendService {
	#dbg = dbg(this, 'AttendService');

	constructor(private member: MemberService, private state: StateService, private data: DataService, private snack: SnackService) { this.#dbg('new'); }

	/** Insert an Attend document, aligned to an active Payment, Schedule, Bonus, Member  */
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
			return this.snack.error(`This schedule item not available today: ${schedule[field]}`);

		// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
		// check we are not re-booking same Class on same Day in same Location at same ScheduleTime
		const bookAttend = await this.data.getStore<Attend>(STORE.Attend, [
			Fire.addWhere(FIELD.Uid, data.auth.current![FIELD.Uid]),
			Fire.addWhere(`track.${FIELD.Date}`, when),
			Fire.addWhere(`timetable.${FIELD.Key}`, schedule[FIELD.Key]),
			Fire.addWhere(`timetable.${FIELD.Id}`, schedule[FIELD.Id]),// schedule has <location>, <instructor>, <startTime>
			Fire.addWhere('note', schedule[FIELD.Note]),		// a different 'note' will allow us to re-book same Class
		])

		// if no Note, then check if same Class / date / startTime / comment is already booked
		if (bookAttend.length && isUndefined(schedule[FIELD.Note]) && isDefined(schedule[COLLECTION.Forum]?.[STORE.Comment])) {
			const bookForum = await this.data.getStore<Comment>(STORE.Comment, [
				Fire.addWhere(FIELD.Uid, data.auth.current![FIELD.Uid]),
				Fire.addWhere(FIELD.Type, schedule[FIELD.Store]),
				Fire.addWhere(`track.${FIELD.Date}`, when),
				Fire.addWhere(`track.${STORE.Class}`, schedule[FIELD.Key]),
				Fire.addWhere('start', schedule.start),
				Fire.addWhere(STORE.Comment, schedule[COLLECTION.Forum]?.[STORE.Comment]),
			])
			if (!bookForum.length)													// if no booking for this Comment
				bookAttend.truncate();												// then allow this Attend
		}

		if (bookAttend.length) {													// disallow same Class, same Note
			const noNote = !schedule[FIELD.Note] && bookAttend.some(row => isUndefined(row[FIELD.Note]));
			const isNote = schedule[FIELD.Note] && bookAttend.some(row => row[FIELD.Note] === schedule[FIELD.Note]);
			if (noNote || isNote)
				return this.snack.error(`Already attended ${schedule[FIELD.Key]} on ${now.format(Instant.FORMAT.display)}`);
		}

		// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
		// work out the Price to charge
		if (isUndefined(timetable.price))
			return this.snack.error(`price: No pricing information for this Plan: ${source.member.plan[0].plan}`);

		if (timetable.bonus?.gift) {
			updates.push(...timetable.bonus.gift);					// batch any Gift updates
			delete timetable.bonus.gift;										// not needed
			delete timetable.bonus[FIELD.Note];							// not needed
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

		// TODO: if data.account.payment.length === 0 and schedule.amount === 0
		// then attach the Attend against the latest, closed Payment (if exists, and is same Plan)

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
				if (data.account.payment.length <= 1 || stamp < data.account.payment[1][FIELD.Stamp]) {
					const payment = await this.member.setPayment(0, stamp);
					Object.assign(payment.pay[0], { [FIELD.Uid]: ATTEND.autoApprove, stamp });

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
				data.account.attend = await this.data.getStore(STORE.Attend, Fire.addWhere(`${STORE.Payment}.${FIELD.Id}`, next[FIELD.Id]));
			}

			if (isUndefined(next))
				return this.snack.error('Could not allocate a new Payment');
		}																									// repeat the loop to test if this now-Active Payment is useable

		if (isUndefined(active))
			return this.snack.error('Could not allocate an active Payment');

		const expired = active.pay.find(pay => asArray(pay[FIELD.Note]).indexOf('Credit Expired') !== -1);
		const upd: Partial<Payment> = {};									// updates to the Payment
		if (!active[FIELD.Effect])
			upd[FIELD.Effect] = stamp;											// mark Effective on first check-in
		if ((data.account.summary.funds === schedule.amount) && schedule.amount)
			upd[FIELD.Expire] = expired?.[FIELD.Stamp] ?? stamp;		// mark Expired if no funds (except $0 classes)
		if (!active.expiry && active.pay[0][FIELD.Stamp] && isUndefined(timetable.bonus))
			upd.expiry = calcExpiry(active, data.client);		// calc an Expriy for the Payment

		if (!isEmpty(upd))																// changes to the active Payment
			updates.push({ ...active, ...upd });						// so, batch the Payment update

		if (data.member.plan[0].plan === PLAN.Intro && (data.account.summary.funds - schedule.amount) <= 0)
			this.member.setPlan(PLAN.Member, stamp + 1);		// auto-bump 'intro' to 'member' Plan

		// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
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
		creates.push(attendDoc);													// batch the new Attend

		// got everything we need; insert an Attend document and update any Payment, Gift, Forum documents
		return this.data.batch(creates, updates, undefined, attendAction.Sync)
			.then(_ => this.member.setAccount(creates, updates, data))
	}

	/** look back up-to seven days to find when className was last scheduled */
	private lkpDate = async (className?: string, location?: string, date?: Instant.TYPE) => {
		const timetable = await this.state.getTimetableData(date).toPromise();
		let now = getInstant(date);															// start with date-argument
		const hhmi = now.format(Instant.FORMAT.HHMI);						// the time of the check-in
		let ctr = 0;

		if (!className)
			className = this.state.getDefault(timetable, STORE.Class);
		if (!location)
			location = this.state.getDefault(timetable, STORE.Location);

		for (ctr; ctr < 7; ctr++) {
			const where: Fire.Where[] = [													// loop through schedule
				Fire.addWhere('day', now.dow),											// finding a match in 'day-of-week'
				Fire.addWhere(FIELD.Key, className),								// and match in 'class'
				Fire.addWhere('location', location),								// and match in 'location'
			]

			const match = nearAt(timetable[COLLECTION.Client][STORE.Schedule]!, where, now,
				{ start: hhmi })																		// match by time, in case offered multiple times in a day

			if (!isEmpty(match))																	// found a class offered on this day
				break;
			now = now.add(-1, 'day');															// else move pointer to previous day
		}

		if (ctr >= 7)																						// cannot find className on timetable
			now = getInstant(date);																// so default back to today's date	

		return now.ts;																					// timestamp
	}

	/**
	 * Removing Attends is a tricky business...  
	 * it may need to walk back a couple of related Documents.  
	 * Avoid deleting a non-latest Attend,
	 * as this will affect Bonus pricing, Gift tracking, Bank rollovers, etc.  
	 * Safer instead to delete all Attends from a given date.
	 */
	public delAttend = async (where: Fire.Query["where"]) => {
		const memberUid = Fire.addWhere(FIELD.Uid, (await this.data.getCurrentUser()));
		const filter = asArray(where);
		if (!filter.map(clause => clause.fieldPath).includes(FIELD.Uid))
			filter.push(memberUid);															// ensure UID is present in where-clause

		const updates: FireDocument[] = [];
		const deletes: FireDocument[] = [];

		const list = await this.data.getStore<Attend>(STORE.Attend, filter);
		if (list.length === 0) {
			this.#dbg('No items to delete');
			return;																							// bail-out
		}

		const payIds = list																		// the Payment IDs related to this reversal
			.map(attend => attend.payment[FIELD.Id])
			.distinct();
		const giftIds = list																	// the Gift IDs related to this reversal
			.filter(attend => attend.bonus?.[FIELD.Type] === BONUS.Gift)
			.map(row => row.bonus![FIELD.Id])
			.distinct();
		const scheduleIds = list															// the Schedule IDs that may have Forum content
			.map(attend => attend.timetable[FIELD.Id])
			.distinct();
		const dates = list																		// the Dates these Attends might have Forum content
			.map(attend => attend.track.date)
			.distinct();

		/**
		 * attends:		all the Attends that relate to the payIDs (even those about to be deleted)
		 * payments:	all the Payments related to this Member
		 * gifts:			all the Gifts related to this reversal
		 * forum:			all the Forum content related to this reversal
		 */
		const [attends, payments, gifts, forum] = await Promise.all([
			this.data.getStore<Attend>(STORE.Attend, Fire.addWhere(`payment.${FIELD.Id}`, payIds)),
			this.data.getStore<Payment & Chain>(STORE.Payment, memberUid),
			this.data.getStore<Gift>(STORE.Gift, [memberUid, Fire.addWhere(FIELD.Id, giftIds)]),
			this.data.select<React | Comment>(COLLECTION.Forum, {
				where: [
					memberUid,
					Fire.addWhere(FIELD.Type, STORE.Schedule),
					Fire.addWhere(FIELD.Key, scheduleIds, '=='),			// TODO: this workaround for FireStore's limit
					Fire.addWhere('track.date', dates, '=='),					//			on number of 'in' clauses in a Query
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
			}, {} as Record<string, number>)

		const chg = new Set<string>();
		list.forEach(attend => {
			let idx: number;

			if (attend.bonus?.[FIELD.Type] === BONUS.Gift) {
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

		deletes.push(...list, ...forum);												// delete Forum content as well
		updates.push(...gifts);																	// batch the updates to Gifts
		updates.push(...payments
			.filter(row => chg.has(row[FIELD.Id]))								// only those that have changed
			.map(row => ({ ...row, chain: undefined }))						// drop the calculated chain
		);

		return this.data.batch(undefined, updates, deletes)
			.then(_ => this.member.updAccount())
	}
}