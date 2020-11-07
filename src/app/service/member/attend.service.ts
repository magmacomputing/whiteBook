import { Injectable } from '@angular/core';
import { combineLatest } from 'rxjs';
import { take } from 'rxjs/operators';

import { DBaseModule } from '@dbase/dbase.module';
import { fire } from '@dbase/fire/fire.library';
import { StateService } from '@dbase/state/state.service';
import { attendAction } from '@dbase/state/state.action';
import { sumPayment, sumAttend } from '@dbase/state/state.library';

import { DataService } from '@dbase/data/data.service';
import { STORE, FIELD, BONUS, PLAN, SCHEDULE, COLLECTION } from '@dbase/data/data.define';
import type { FireDocument, TStoreBase, Attend, Schedule, Payment, Gift, React, Comment } from '@dbase/data/data.schema';

import { PAY, ATTEND } from '@service/member/attend.define';
import { calcExpiry } from '@service/member/member.library';
import { MemberService } from '@service/member/member.service';
import { SnackService } from '@service/material/snack.service';

import { getInstant, Instant, TInstant } from '@library/instant.library';
import { isUndefined, isNumber, isEmpty, nullToZero } from '@library/type.library';
import { getPath } from '@library/object.library';
import { asArray } from '@library/array.library';
import { dbg } from '@library/logger.library';

/** Add/Delete to the Attend collection */
@Injectable({ providedIn: DBaseModule })
export class AttendService {
	private self = 'AttendService';
	private dbg = dbg(this, this.self);

	constructor(private member: MemberService, private state: StateService, private data: DataService, private snack: SnackService) { this.dbg('new'); }

	/** Insert an Attend document, aligned to an active Payment  */
	public setAttend = async (schedule: Schedule, date?: TInstant) => {
		const creates: FireDocument[] = [];
		const updates: FireDocument[] = [];

		// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
		// if no <date>, then look back up-to 7 days to find when the Scheduled class was last offered.  
		// This presumes that the <key> is from Schedule store, and not Calendar
		if (isUndefined(date))
			date = await this.lkpDate(schedule[FIELD.key], schedule.location);
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
		const field = schedule[FIELD.store] === STORE.schedule
			? FIELD.id																			// compare requested schedule to timetable's ID
			: FIELD.key																			// compare requested event to class's Key
		const timetable = source.client.schedule!.find(row => row[field] === schedule[field]);
		if (!timetable)																		// this schedule is not actually offered on this date!
			return this.snack.error(`This schedule item not available today: ${schedule[FIELD.id]}`);

		// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
		// check we are not re-booking same Class on same Day in same Location at same ScedhuleTime
		const bookAttend = await this.data.getStore<Attend>(STORE.attend, [
			fire.addWhere(FIELD.uid, data.auth.current!.uid),
			fire.addWhere(`track.${FIELD.date}`, when),
			fire.addWhere(`timetable.${FIELD.key}`, schedule[FIELD.key]),
			fire.addWhere(`timetable.${FIELD.id}`, schedule[FIELD.id]),// schedule has <location>, <instructor>, <startTime>
			fire.addWhere('note', schedule[FIELD.note]),					// a different 'note' will allow us to re-book same Class
		]);

		if (bookAttend.length) {													// disallow same Class, same Note
			const noNote = !schedule[FIELD.note] && bookAttend.some(row => isUndefined(row[FIELD.note]));
			const isNote = schedule[FIELD.note] && bookAttend.some(row => row[FIELD.note] === schedule[FIELD.note]);
			if (noNote || isNote)
				return this.snack.error(`Already attended ${schedule[FIELD.key]} on ${now.format(Instant.FORMAT.display)}`);
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
		if (timetable.bonus?.[FIELD.id])
			timetable.price!.amount = nullToZero(timetable.bonus.amount);	// override Plan price

		// if the caller provided a schedule.amount, and it is different to the calculated amount!  
		// this is useful for the bulk Migration of attends
		if (!isUndefined(schedule.amount) && schedule.amount !== timetable.price.amount) {// calculation mis-match
			this.dbg('bonus: %j', timetable.bonus);
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

			this.dbg('limit: %j, %j', tests[PAY.under_limit], data.account.attend.length);
			this.dbg('funds: %j, %j, %j', tests[PAY.enough_funds], schedule.amount, data.account.summary);
			this.dbg('expiry: %j, %j, %j', tests[PAY.not_expired], now.ts, expiry);

			// If over-limit (100+ Attends per Payment) but still have sufficient funds to cover this Class price,
			// 	insert an auto-approved $0 Payment (only if the next Attend is earlier than any future Payments)
			if (!tests[PAY.under_limit] && tests[PAY.enough_funds]) {
				if (data.account.payment.length <= 1 || stamp < data.account.payment[1].stamp) {
					const payment = await this.member.setPayment(0, stamp);
					payment.approve = { uid: ATTEND.autoApprove, stamp };

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
					updates.push({ [FIELD.effect]: stamp, [FIELD.expire]: stamp, ...active });	// close previous Payment
				if (data.account.summary.funds)
					updates.push({ ...data.account.payment[queue] });	// update the now-Active payment with <bank>

				if (active)
					data.account.payment = data.account.payment.slice(1);// drop the 1st, now-inactive payment
				data.account.attend = await this.data.getStore(STORE.attend, fire.addWhere(`${STORE.payment}.${FIELD.id}`, next[FIELD.id]));
			}

			if (isUndefined(next))
				return this.snack.error('Could not allocate a new Payment');
		}																									// repeat the loop to test if this now-Active Payment is useable
		if (isUndefined(active))
			return this.snack.error('Could not allocate an active Payment');

		const upd: Partial<Payment> = {};								// updates to the Payment
		if (!active[FIELD.effect])
			upd[FIELD.effect] = stamp;											// mark Effective on first check-in
		if ((data.account.summary.funds === schedule.amount) && schedule.amount)
			upd[FIELD.expire] = stamp;											// mark Expired if no funds (except $0 classes)
		if (!active.expiry && active.approve && isUndefined(timetable.bonus))	// calc an Expiry for this Payment
			upd.expiry = calcExpiry(active.approve.stamp, active, data.client);

		if (!isEmpty(upd))																// changes to the active Payment
			updates.push({ ...active, ...upd });						// so, batch the Payment update

		if (data.member.plan[0].plan === PLAN.intro && (data.account.summary.funds - schedule.amount) <= 0)
			this.member.setPlan(PLAN.member, stamp + 1);		// auto-bump 'intro' to 'member' Plan

		// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
		// got everything we need; insert an Attend document and update any Payment, Gift, Forum documents

		const attendDoc: Partial<Attend> = {
			[FIELD.store]: STORE.attend,
			[FIELD.stamp]: stamp,														// createDate
			[FIELD.note]: schedule[FIELD.note],							// optional 'note'
			timetable: {
				[FIELD.id]: schedule[FIELD.id],								// <id> of the Schedule
				[FIELD.key]: schedule[FIELD.key],							// the Attend's class
				[FIELD.store]: schedule[FIELD.type] === SCHEDULE.class ? STORE.schedule : STORE.calendar,
				[FIELD.type]: schedule[FIELD.type],						// the type of Attend ('class', 'event', 'special')
			},
			payment: {
				[FIELD.id]: active[FIELD.id],									// <id> of Account's current active document
				amount: schedule.amount,											// calculated price of the Attend
			},
			track: {
				[FIELD.date]: when,														// yyyymmdd of the Attend
				day: now.dow,																	// day of week
				week: now.format(Instant.FORMAT.yearWeek),		// week-number of year
				month: now.format(Instant.FORMAT.yearMonth),	// month-number of year
			},
			bonus: timetable.bonus,													// <id>/<type>/<count> of Bonus
		}

		creates.push(attendDoc as TStoreBase);						// batch the new Attend
		return this.data.batch(creates, updates, undefined, attendAction.Sync)
			.then(_ => this.member.setAccount(creates, updates, data))
	}

	/** look back up-to seven days to find when className was last scheduled */
	private lkpDate = async (className: string, location?: string, date?: TInstant) => {
		const timetable = await this.state.getTimetableData(date).toPromise();
		let now = getInstant(date);																// start with date-argument
		let ctr = 0;

		if (!location)
			location = this.state.getDefault(timetable, STORE.location);

		for (ctr; ctr < 7; ctr++) {
			const classes = timetable.client.schedule!						// loop through schedule
				.filter(row => row.day === now.dow)									// finding a match in 'day'
				.filter(row => row[FIELD.key] === className)				// and match in 'class'
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
		const memberUid = fire.addWhere(FIELD.uid, (await this.data.getUID()));
		const filter = asArray(where);
		if (!filter.map(clause => clause.fieldPath).includes(FIELD.uid))
			filter.push(memberUid);																// ensure UID is present in where-clause

		const updates: FireDocument[] = [];
		const deletes: FireDocument[] = await this.data.getStore<Attend>(STORE.attend, filter);

		if (deletes.length === 0) {
			this.dbg('No items to delete');
			return;
		}

		const payIds = (deletes as Attend[])									// the Payment IDs related to this reversal
			.map(attend => attend.payment[FIELD.id])
			.distinct();
		const giftIds = (deletes as Attend[])									// the Gift IDs related to this reversal
			.filter(attend => attend.bonus?.[FIELD.type] === BONUS.gift)
			.map(row => row.bonus![FIELD.id])
			.distinct();
		const scheduleIds = (deletes as Attend[])							// the Schedule IDs that may have Forum content
			.map(attend => attend.timetable[FIELD.id])
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
			this.data.getStore<Attend>(STORE.attend, fire.addWhere(`payment.${FIELD.id}`, payIds)),
			this.data.getStore<Payment>(STORE.payment, memberUid),
			this.data.getStore<Gift>(STORE.gift, [memberUid, fire.addWhere(FIELD.id, giftIds)]),
			this.data.getFire<React | Comment>(COLLECTION.forum, {
				where: [
					memberUid,
					fire.addWhere(FIELD.type, STORE.schedule),
					fire.addWhere(FIELD.key, scheduleIds, '=='),			// TODO: this workaround for FireStore limit
					fire.addWhere('track.date', dates, '=='),					// on number of 'in' clauses in a Query
				]
			}),
		])

		// build a linked-list of Payments
		payments
			.orderBy({ field: FIELD.stamp, dir: 'desc' }, FIELD.type)
			.forEach((payment, idx, arr) => {
				payment.chain = {
					parent: idx + 1 < arr.length && arr[idx + 1][FIELD.id] || undefined,
					child: idx !== 0 && arr[idx - 1][FIELD.id] || undefined,
					index: idx,
				}
			})

		let pays = attends																			// count the number of Attends per Payment
			.map(row => row.payment[FIELD.id])
			.reduce((acc, itm) => {
				acc[itm] = nullToZero(acc[itm]) + 1;
				return acc;
			}, {} as Record<any, number>)

		const chg = new Set<string>();
		deletes.forEach(attend => {
			let idx: number;

			if (attend.bonus && attend.bonus[FIELD.type] === BONUS.gift) {
				idx = gifts.findIndex(row => row[FIELD.id] === attend.bonus![FIELD.id]);
				const gift = gifts[idx];
				if (gift) {
					if (isNumber(gift.count))
						gift.count! -= 1;																// decrement running-total
					if (gift.count === 0)
						gift.count = undefined;													// discard running-total
					if (isNumber(gift[FIELD.expire]))
						gift[FIELD.expire] = undefined;									// re-open a Gift
				}
			}

			const payId = attend.payment[FIELD.id];								// get the Payment id
			idx = payments.findIndex(row => row[FIELD.id] === payId);
			const payment = payments[idx];
			if (payment) {
				if (isNumber(payment[FIELD.expire]))
					payment[FIELD.expire] = undefined;								// re-open a Payment
				pays[payId] -= 1;																		// reduce the number of Attends for this Payment
				if (pays[payId] === 0) {														// no other Attend booked against this Payment
					payment[FIELD.effect] = undefined;								// so, mark the Payment as not-yet-effective
					payment.bank = undefined;													// TODO: dont clear down Payment, if parent had $0 funds

					chg.add(payId);																		// mark this Payment as 'changed
					const parent = payment.chain!.parent;
					if (parent) {
						payments[idx + 1][FIELD.expire] = undefined;		// un-expire the parent
						chg.add(payments[idx + 1][FIELD.id]);						// mark the parent as 'changed'
					}
				}
			}
		})

		deletes.push(...forum);																	// delete Forum content as well
		updates.push(...gifts);																	// batch the updates to Gifts
		updates.push(...payments
			.filter(row => chg.has(row[FIELD.id]))								// only those that have changed
			.map(row => ({ ...row, chain: undefined }))						// drop the calculated chain
		);

		return this.data.batch(undefined, updates, deletes)
			.then(_ => this.member.updAccount())
	}
}