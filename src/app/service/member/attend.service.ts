import { Injectable } from '@angular/core';
import { combineLatest } from 'rxjs';
import { take } from 'rxjs/operators';

import { addWhere } from '@dbase/fire/fire.library';
import { StateService } from '@dbase/state/state.service';
import { sumPayment, sumAttend } from '@dbase/state/state.library';
import { SyncAttend } from '@dbase/state/state.action';
import { STORE, FIELD, BONUS, PLAN, SCHEDULE, COLLECTION } from '@dbase/data/data.define';

import { PAY, ATTEND } from '@service/member/attend.define';
import { calcExpiry } from '@service/member/member.library';
import { MemberService } from '@service/member/member.service';
import { SnackService } from '@service/material/snack.service';
import { DBaseModule } from '@dbase/dbase.module';
import { TWhere } from '@dbase/fire/fire.interface';
import { DataService } from '@dbase/data/data.service';
import { IAttend, IStoreMeta, TStoreBase, ISchedule, IPayment, IGift, IForumBase } from '@dbase/data/data.schema';

import { getDate, Instant, TDate } from '@lib/instant.library';
import { isUndefined, isNumber } from '@lib/type.library';
import { getPath, isEmpty, sortKeys } from '@lib/object.library';
import { asArray } from '@lib/array.library';
import { dbg } from '@lib/logger.library';

/** Manage the 'attend' store */
@Injectable({ providedIn: DBaseModule })
export class AttendService {
	private dbg = dbg(this);

	constructor(private member: MemberService, private state: StateService, private data: DataService, private snack: SnackService) { this.dbg('new'); }

	/** Insert an Attend document, aligned to an active Payment  */
	public setAttend = async (schedule: ISchedule, date?: TDate) => {
		const creates: IStoreMeta[] = [];
		const updates: IStoreMeta[] = [];

		// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
		// if no <date>, then look back up-to 7 days to find when the Scheduled class was last offered
		// This presumes that the <key> is from Schedule store, and not Calendar
		if (isUndefined(date))
			date = await this.lkpDate(schedule[FIELD.key], schedule.location);
		const now = getDate(date);
		const stamp = now.ts;
		const when = now.format(Instant.FORMAT.yearMonthDay);

		// There is a bit of overlap in these Observables, but they serve different purposes
		let [data, source] = await combineLatest(
			this.state.getAccountData(date),								// get Member's current account details
			this.state.getScheduleData(date, schedule.elect),// get Schedule for this date
		)
			.pipe(take(1))																	// unsubscribe on first-emit
			.toPromise()																		// emit observables as Promise

		// <schedule> might be from Schedule or Calender store
		const field = schedule[FIELD.store] === STORE.schedule
			? FIELD.id																			// compare requested schedule to timetable's ID
			: FIELD.key																			// compare requested event to class's Key
		const timetable = source.client.schedule!.find(row => row[field] === schedule[field]);
		if (!timetable) {																	// this schedule is not actually offered on this date!
			this.dbg(`Cannot find this schedule item: ${schedule[FIELD.id]}`);
			this.snack.error(`Cannot find this schedule item: ${schedule[FIELD.id]}`);
			return false;																		// this should not happen
		}

		// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
		// check we are not re-booking same Class on same Day in same Location at same ScedhuleTime
		const bookAttend = await this.data.getStore<IAttend>(STORE.attend, [
			addWhere(FIELD.uid, data.auth.current!.uid),
			addWhere(`track.${FIELD.date}`, when),
			addWhere(`timetable.${FIELD.key}`, schedule[FIELD.key]),
			addWhere(`timetable.${FIELD.id}`, schedule[FIELD.id]),// schedule has <location>, <instructor>, <startTime>
			addWhere('note', schedule[FIELD.note]),
		]);

		if (bookAttend.length) {															// disallow same Class, same Note
			debugger;
			this.dbg(`Already attended ${schedule[FIELD.key]} on ${now.format(Instant.FORMAT.display)}`);
			this.snack.error(`Already attended ${schedule[FIELD.key]} on ${now.format(Instant.FORMAT.display)}`);
			return false;																				// discard Attend
		}

		// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
		// work out the actual price to charge
		if (!isEmpty(timetable.bonus) && timetable.bonus) {
			if (timetable.bonus.gift) {
				updates.push(...timetable.bonus.gift);						// batch any Gift updates
				delete timetable.bonus.gift;											// not needed
				delete timetable.bonus.desc;											// not needed
			}
			if (timetable.bonus[FIELD.id])
				timetable.price!.amount = timetable.bonus.amount || 0;	// override Plan price
		}

		// if the caller provided a schedule.amount, and it is different to the calculated amount!
		if (!isUndefined(schedule.amount) && schedule.amount !== timetable.price!.amount) {// calculation mis-match
			this.dbg('bonus: %j', timetable.bonus);
			this.snack.error(`Price discrepancy: paid ${schedule.amount}, but should be ${timetable.price!.amount}`);
			throw new Error(`Price discrepancy: paid ${schedule.amount}, but should be ${timetable.price!.amount}`);
		}
		schedule.amount = timetable.price!.amount;				// the price to use for this class

		// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
		// loop through Payments to determine which should be <active>
		let active: IPayment | undefined;									// Payment[0] is assumed active, by default
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
			if (!tests[PAY.under_limit] && tests[PAY.enough_funds] /** && tests[PAY.not_expired] */) {
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
				data.account.attend = await this.data.getStore(STORE.attend, addWhere(`${STORE.payment}.${FIELD.id}`, next[FIELD.id]));
			}

			if (isUndefined(next)) {
				return this.snack.error('Could not allocate a new Payment');
				// throw new Error('Could not allocate a new Payment');
			}
		}																									// repeat the loop to test if this now-Active Payment is useable
		if (isUndefined(active)) {
			return this.snack.error('Could not allocate an active Payment');
			// throw new Error('Could not allocate an active Payment');
		}

		const upd: Partial<IPayment> = {};								// updates to the Payment
		if (!active[FIELD.effect])
			upd[FIELD.effect] = stamp;											// mark Effective on first check-in
		if ((data.account.summary.funds === schedule.amount) && schedule.amount)
			upd[FIELD.expire] = stamp;											// mark Expired if no funds (except $0 classes)
		if (!active.expiry && active.approve && isEmpty(timetable.bonus))	// calc an Expiry for this Payment
			upd.expiry = calcExpiry(active.approve.stamp, active, data.client);

		if (Object.keys(upd).length)											// changes to the active Payment
			updates.push({ ...active, ...upd });						// so, batch the Payment update

		if (data.member.plan[0].plan === PLAN.intro && (data.account.summary.funds - schedule.amount) <= 0)
			this.member.setPlan(PLAN.member, stamp + 1);				// auto-bump 'intro' to 'member' Plan

		// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
		// got everything we need; insert an Attend document and update any Payment, Gift, Forum documents

		const attendDoc: Partial<IAttend> = {
			[FIELD.store]: STORE.attend,
			[FIELD.stamp]: stamp,														// createDate
			[FIELD.note]: schedule[FIELD.note],							// optional 'note'
			timetable: {
				[FIELD.id]: schedule[FIELD.id],								// <id> of the Schedule
				[FIELD.key]: schedule[FIELD.key],							// the Attend's class
				[FIELD.store]: schedule[FIELD.type] === SCHEDULE.class ? STORE.schedule : STORE.calendar,
				[FIELD.type]: schedule[FIELD.type],						// the type of Attend ('class','event','special')
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
			bonus: !isEmpty(timetable.bonus) ? timetable.bonus : undefined,			// <id>/<type>/<count> of Bonus
		}

		creates.push(attendDoc as TStoreBase);						// batch the new Attend
		return this.data.batch(creates, updates, undefined, SyncAttend)
			.then(_ => this.member.setAccount(creates, updates, data))
	}

	/** look back up-to seven days to find when className was last scheduled */
	private lkpDate = async (className: string, location?: string, date?: TDate) => {
		const timetable = await this.state.getTimetableData(date).toPromise();
		let now = getDate(date);																// start with date-argument
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
			now = getDate(date);																	// so default back to today's date	

		return now.ts;																					// timestamp
	}

	public delPayment = async (where: TWhere) => {
		const memberUid = addWhere(FIELD.uid, (await this.data.getUID()));
		const filter = asArray(where);
		if (!filter.map(clause => clause.fieldPath).includes(FIELD.uid))
			filter.push(memberUid);

		const updates: IStoreMeta[] = [];
		const deletes: IStoreMeta[] = await this.data.getStore<IPayment>(STORE.payment, filter);

		if (deletes.length === 0) {
			this.dbg('No items to delete');
			return;
		}
	}

	/**
	 * Removing Attends is a tricky business...  
	 * it may need to walk back a couple of related Documents.  
	 * Take great care when deleting a non-latest Attend,
	 * as this will affect Bonus pricing, Gift tracking, Bank rollovers, etc.
	 */
	public delAttend = async (where: TWhere) => {
		const memberUid = addWhere(FIELD.uid, (await this.data.getUID()));
		const filter = asArray(where);
		if (!filter.map(clause => clause.fieldPath).includes(FIELD.uid))
			filter.push(memberUid);

		const updates: IStoreMeta[] = [];
		const deletes: IStoreMeta[] = await this.data.getStore<IAttend>(STORE.attend, filter);

		if (deletes.length === 0) {
			this.dbg('No items to delete');
			return;
		}

		const payIds = deletes												// the Payment IDs related to this reversal
			.map(attend => attend.payment[FIELD.id])
			.distinct();
		const giftIds = deletes												// the Gift IDs related to this reversal
			.filter(attend => attend.bonus && attend.bonus[FIELD.type] === BONUS.gift)
			.map(row => row.bonus[FIELD.id])
			.distinct();
		const scheduleIds = deletes										// the Schedule IDs that may have Forum content
			.map(attend => attend.timetable[FIELD.id])
			.distinct();
		const dates = deletes													// the Dates these Attends have Forum content
			.map(attend => attend.track.date)
			.distinct();

		/**
		 * attends:		all the Attends that relate to the payIDs (even those about to be deleted)
		 * payments:	all the Payments related to this Member
		 * gifts:			all the Gifts related to this reversal
		 * forum:			all the Forum content related to this reversal
		 */
		const [attends, payments, gifts, forum] = await Promise.all([
			this.data.getStore<IAttend>(STORE.attend, addWhere(`payment.${FIELD.id}`, payIds)),
			this.data.getStore<IPayment>(STORE.payment, memberUid),
			this.data.getStore<IGift>(STORE.gift, [memberUid, addWhere(FIELD.id, giftIds)]),
			this.data.getFire<IForumBase>(COLLECTION.forum, {
				where: [
					memberUid,
					addWhere(FIELD.type, STORE.schedule),
					addWhere(FIELD.key, scheduleIds),
					addWhere('track.date', dates),
				]
			}),
		])

		// build a link-link of Payments, assume pre-sorted by stamp [desc]
		payments
			.sort(sortKeys('-' + FIELD.stamp, FIELD.type))
			.forEach((payment, idx, arr) => {
				payment.link = {
					parent: idx + 1 < arr.length && arr[idx + 1][FIELD.id] || undefined,
					child: idx !== 0 && arr[idx - 1][FIELD.id] || undefined,
					index: idx,
				}
			})

		let pays = attends														// count the number of Attends per Payment
			.map(row => row.payment[FIELD.id])
			.reduce((acc, itm) => {
				if (isUndefined(acc[itm]))
					acc[itm] = 0;
				acc[itm] += 1;
				return acc;
			}, {} as Record<string, number>);

		const chg = new Set<string>();
		deletes.forEach(attend => {
			let idx: number;
			if (attend.bonus && attend.bonus[FIELD.type] === BONUS.gift) {
				idx = gifts.findIndex(row => row[FIELD.id] === attend.bonus![FIELD.id]);
				const gift = gifts[idx];
				if (gift) {
					if (isNumber(gift.count))
						gift.count! -= 1;											// decrement running-total
					if (gift.count === 0)
						gift.count = undefined;								// discard running-total
					if (isNumber(gift[FIELD.expire]))
						gift[FIELD.expire] = undefined;				// re-open a Gift
				}
			}

			const payId = attend.payment[FIELD.id];			// get the Payment id
			idx = payments.findIndex(row => row[FIELD.id] === payId);
			const payment = payments[idx];
			if (payment) {
				if (isNumber(payment[FIELD.expire]))
					payment[FIELD.expire] = undefined;			// re-open a Payment
				pays[payId] -= 1;													// reduce the number of Attends for this Payment
				if (pays[payId] === 0) {									// no other Attend booked against this Payment
					payment[FIELD.effect] = undefined;
					payment.bank = undefined;								// TODO: dont clear down Payment, if parent had $0 funds

					chg.add(payId);													// mark this Payment as 'changed
					const parent = payment.link!.parent;
					if (parent) {
						payments[idx + 1][FIELD.expire] = undefined;
						chg.add(payments[idx + 1][FIELD.id]);	// mark the parent as 'changed'
					}
				}
			}
		})

		deletes.push(...forum);												// delete Forum content as well
		updates.push(...gifts);												// batch the updates to Gifts
		updates.push(...payments
			.filter(row => chg.has(row[FIELD.id]))			// only those that have changed
			.map(row => ({ ...row, link: undefined }))	// drop the calculated link
		);

		return this.data.batch(undefined, updates, deletes)
			.then(_ => this.member.updAccount())
	}
}