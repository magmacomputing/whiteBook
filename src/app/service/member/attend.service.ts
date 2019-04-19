import { Injectable } from '@angular/core';

import { addWhere } from '@dbase/fire/fire.library';
import { StateService } from '@dbase/state/state.service';
import { IAccountState } from '@dbase/state/state.define';
import { sumPayment, sumAttend } from '@dbase/state/state.library';
import { SyncAttend } from '@dbase/state/state.action';
import { STORE, FIELD } from '@dbase/data/data.define';

import { MEMBER } from '@service/member/member.define';
import { calcExpiry } from '@service/member/member.library';
import { MemberService } from '@service/member/member.service';
import { SnackService } from '@service/snack/snack.service';
import { DBaseModule } from '@dbase/dbase.module';
import { DataService } from '@dbase/data/data.service';
import { IAttend, IStoreMeta, TClass, TStoreBase, ISchedule, IPayment } from '@dbase/data/data.schema';

import { getDate, DATE_FMT } from '@lib/date.library';
import { isUndefined, TString } from '@lib/type.library';
import { cloneObj, getPath } from '@lib/object.library';
import { dbg } from '@lib/logger.library';

@Injectable({ providedIn: DBaseModule })
export class AttendService {
	private dbg = dbg(this);

	constructor(private member: MemberService, private state: StateService, private data: DataService, private snack: SnackService) { this.dbg('new') }

	/** loop back up-to-seven days to find when className was last scheduled */
	lkpDate = async (className: string, location?: string, date?: number) => {
		const timetable = await this.state.getTimetableData(date).toPromise();
		let now = getDate(date);													// start with date-argument
		let ctr = 0;

		if (!location)
			location = this.state.getDefault(timetable, STORE.location);

		for (ctr; ctr < 7; ctr++) {
			const classes = timetable.client.schedule!			// loop through schedule
				.filter(row => row.day === now.dow)						// finding a match in 'day'
				.filter(row => row[FIELD.key] === className)	// and match in 'class'
				.filter(row => row.location === location)			// and match in 'location'

			if (classes.length)															// is this class offered on this 'day'   
				break;
			now = now.add(-1, 'day');												// move pointer to previous day
		}

		if (ctr >= 7)																			// cannot find className on timetable
			now = getDate(date);														// so default back to today's date	

		return now.ts;																		// timestamp
	}

	// TODO: if their intro-pass has expired (auto bump them to 'default' plan)  
	/**
	 * Determine active Payment, as   
   * -> the price of the class is less or equal to funds on a Payment  
   * -> they've not exceeded 99 Attends against a Payment  
	 * -> this check-in is earlier than Payment expiry-date  
  */
	async getPayment(data: IAccountState, price: number, ts: number) {
		let source = cloneObj(data);											// dont mutate original data
		const payments = cloneObj(data.account.payment);
		const tests: boolean[] = [];											// array of 'tests' to determine if <active>
		let active = 0;																		// start at the last active Payment

		do {
			tests.push(source.account.attend.length < MEMBER.maxColumn);	// arbitrary limit of Attends against a Payment             
			tests.push(price < source.account.summary.funds);// enough funds to cover this Attend
			tests.push(ts < (payments[0].expiry || Number.MAX_SAFE_INTEGER));

		} while (tests.some(check => check === false)) {
			tests.length = 0;																// reset tests
			active += 1;																		// move to next Payment

			payments.shift();																// drop off top-of-list
			if (!payments[0][FIELD.effect]) {								// if now top-of-list Payment is not yet in-use
				payments[0].bank = source.account.summary.funds;// do a dummy-rollover to calc <bank>
			}

			source.account.payment = payments;							// build a new Payment array
			source = sumPayment(source);										// calculate the Summary for this Payment

			const paymentId = payments[0][FIELD.id];				//
			const attendState = await this.state.getAttendData(paymentId)
				.toPromise();																	// lookup Attends against this Payment
			source.account.attend = attendState[paymentId];	// build a new Attend array
			source = sumAttend(source);											// offset Summary by the cost of Attends
		}

		return active;
	}

	/**
	 * Insert an Attendance record, matched to an <active> Account Payment  
	 */
	async setAttend(schedule: ISchedule, note?: TString, date?: number) {
		let data = await this.member.getAccount(date);		// get Member's current account details

		// If no <price> on Schedule, then lookup based on member's plan
		if (isUndefined(schedule.price))
			schedule.price = await this.member.getEventPrice(schedule[FIELD.key], data);

		// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
		// TODO: check if <price> should be overridden with Bonus
		let bonus: string | undefined;										// reference the Bonus that applies to this attend
		if (schedule.price === 0) {

		}

		// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
		// if no <date>, then look back up-to 7 days to find when the Scheduled class was last offered
		if (isUndefined(date))
			date = await this.lkpDate(schedule[FIELD.key], schedule.location);

		const now = getDate(date);
		const stamp = now.ts;
		const when = now.format(DATE_FMT.yearMonthDay);

		// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
		// check we are not re-booking same Class on same Day at same Location at same Time
		const attendFilter = [
			addWhere(FIELD.uid, data.auth.current!.uid),
			addWhere(FIELD.note, note),
			addWhere('schedule', schedule[FIELD.id]),
			addWhere('date', when),
		]
		const booked = await this.data.getFire<IAttend>(STORE.attend, { where: attendFilter });
		if (booked.length) {
			switch (true) {
				case isUndefined(note) && booked.filter(attend => isUndefined(attend.note)).length === 0:
					break;																			// we dont already have an Attend with no note
				default:
					this.snack.error(`Already attended ${schedule[FIELD.key]} on ${now.format(DATE_FMT.display)}`);
					return false;																// discard Attend
			}
		}

		// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
		// ensure we have enough credit to cover the price of the check-in
		const creates: IStoreMeta[] = [];
		const updates: IStoreMeta[] = [];

		// if (!data.account.payment[0] || schedule.price > data.account.summary.credit) {
		// 	const gap = schedule.price - data.account.summary.credit;
		// 	const topUp = await this.member.getPayPrice(data);
		// 	const payment = await this.member.setPayment(Math.max(gap, topUp));

		// 	creates.push(payment);													// stack the topUp Payment
		// 	data.account.payment.push(payment);							// append to the Payment array
		// }

		// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
		// Loop through Payments to determine which is <active>
		const tests = new Set<boolean>();									// Set of test results
		let active: IPayment;															// Payment[0]

		do {
			data = sumPayment(data);												// calc Payment summary
			data = sumAttend(data);													// deduct Attends against this Payment
			active = data.account.payment[0];								// current Payment

			tests.add(data.account.attend.length < 100);										// arbitrary limit of Attends against a Payment             
			tests.add(schedule.price <= data.account.summary.funds);				// enough funds to cover this Attend
			tests.add(now.ts < (getPath(active, 'expiry') || Number.MAX_SAFE_INTEGER));	// Payment expired

			if (!tests.has(false))
				break;																				// all tests passed
			tests.clear();																	// reset the test Set
			this.dbg('test1: %j, %j', data.account.attend.length < 100, data.account.attend.length);
			this.dbg('test2: %j, %j, %j', schedule.price <= data.account.summary.funds, schedule.price, data.account.summary);
			this.dbg('test3: %j, %j, %j', now.ts < (active.expiry || Number.MAX_SAFE_INTEGER), now.ts, active.expiry);

			if (data.account.payment.length === 1) {				// create a new Payment
				// this.snack.error(`Cannot find active Payment ${schedule[FIELD.key]} on ${now.format(DATE_FMT.display)}`);
				// return false;																	// discard Attend
				const gap = schedule.price - data.account.summary.credit;
				const topUp = await this.member.getPayPrice(data);
				const payment = await this.member.setPayment(Math.max(gap, topUp));

				if (topUp === 0)
					payment.approve = { uid: 'Auto-Approve', stamp: now.ts }

				creates.push(payment);												// stack the topUp Payment into the batch
				data.account.payment.push(payment);						// append to the Payment array
			}

			const next = data.account.payment[1];
			if (!next.bank) {																// rollover unused funds into next Payment
				data.account.payment[1].bank = data.account.summary.funds;
				updates.push({ ...data.account.payment[1] });
			}

			if (active.approve)															// close previous Payment
				updates.push({ [FIELD.effect]: stamp, [FIELD.expire]: stamp, ...active });

			data.account.payment = data.account.payment.slice(1);// drop the 1st inactive payment
			data.account.attend = await this.data.getStore(STORE.attend, addWhere(STORE.payment, next[FIELD.id]));
		} while (true);

		const upd: Partial<IPayment> = {};								// updates to the Payment
		if (!active[FIELD.effect])
			upd[FIELD.effect] = stamp;											// mark Effective on first check-in
		if (data.account.summary.credit === schedule.price && schedule.price)
			upd[FIELD.expire] = stamp;											// mark Expired if no funds (except $0 classes)
		if (!active.expiry && active.approve)							// calc an Expiry for this Payment
			upd.expiry = calcExpiry(active.approve.stamp, active, data.client);

		if (Object.keys(upd).length)
			updates.push({ ...active, ...upd });						// batch the Payment update

		// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
		// build the Attend document
		const attendDoc: Partial<IAttend> = {
			[FIELD.store]: STORE.attend,
			[FIELD.type]: schedule[FIELD.type],							// the type of Attend ('class','event','special')
			[FIELD.key]: schedule[FIELD.key] as TClass,			// the Attend's class
			[FIELD.stamp]: stamp,														// createDate
			[FIELD.date]: when,															// yyyymmdd of the Attend
			[FIELD.note]: note,															// optional 'note'
			schedule: schedule[FIELD.id],										// <id> of the Schedule
			payment: active[FIELD.id],											// <id> of Account's current active document
			bonus: bonus,																		// <id> of the Bonus
			amount: schedule.price,													// calculated price of the Attend
			track: {
				day: now.dow,																	// day of week
				week: now.format(DATE_FMT.yearWeek),					// week-number of year
				month: now.format(DATE_FMT.yearMonth),				// month-number of year
			}
		}
		creates.push(attendDoc as TStoreBase);						// batch the new Attend

		return this.data.batch(creates, updates, undefined, SyncAttend)
			.then(_ => this.member.getAmount())							// re-calc the new Account summary
			.then(sum => this.data.writeAccount(sum))				// update Admin summary
	}
}