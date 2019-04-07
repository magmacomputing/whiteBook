import { Injectable } from '@angular/core';

import { addWhere } from '@dbase/fire/fire.library';
import { StateService } from '@dbase/state/state.service';
import { ISummary, IAccountState } from '@dbase/state/state.define';
import { sumPayment } from '@dbase/state/state.library';
import { SyncAttend } from '@dbase/state/state.action';
import { STORE, FIELD } from '@dbase/data/data.define';

import { calcExpiry } from '@service/member//member.library';
import { MemberService } from '@service/member/member.service';
import { SnackService } from '@service/snack/snack.service';
import { DBaseModule } from '@dbase/dbase.module';
import { DataService } from '@dbase/data/data.service';
import { ISchedule, IAttend, IStoreMeta, TClass, TStoreBase } from '@dbase/data/data.schema';

import { getDate, DATE_FMT } from '@lib/date.library';
import { isUndefined, TString } from '@lib/type.library';
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
				.filter(row => row.day === now.ww)						// finding a match in 'day'
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

	/**
	 * get (or define a new) active Payment . 
   * Determine if next payment is due.  
   * -> if the price of the class is greater than their current funds  
   * -> if they've exceeded 99 Attends against the active Payment  
	 * -> if this check-in is later than the expiry-date  
   * -> TODO: if their intro-pass has expired (auto bump them to 'default' plan)  
  */
	getPayment(data: IAccountState, price: number, ts: number) {
		const payments = data.account.payment;

		switch (true) {
			case !payments[0][FIELD.effect]:
				return 0;									// new account not-yet-activated

			case data.account.attend.length > 99:
				return 1;									// more than 99-attendances against the activePayment

			case price > data.account.summary.funds:
				return 1;									// time for a new activePayment

			case payments[0].expiry && payments[0].expiry < ts:
				return 1;									// current Payment has expired

			default:
				return 0;
		}
	}

	/**
	 * Insert an Attendance record, matched to an <active> Account Payment  
	 */
	async setAttend(schedule: ISchedule, note?: TString, date?: number) {
		const data = await this.member.getAccount(date);							// get Member's current account details

		// If no <price> on Schedule, then lookup based on member's plan
		if (isUndefined(schedule.price))
			schedule.price = await this.member.getEventPrice(schedule[FIELD.key], data);

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
			this.snack.error(`Already attended ${schedule[FIELD.key]} on ${now.format(DATE_FMT.display)}`);
			return Promise.resolve(false);															// discard Attend
		}

		// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
		// ensure we have enough credit to cover the price of the check-in
		const creates: IStoreMeta[] = [];
		const updates: IStoreMeta[] = [];

		if (schedule.price > data.account.summary.credit) {
			const gap = schedule.price - data.account.summary.credit;
			const topUp = await this.member.getPayPrice(data);
			const payment = await this.member.setPayment(Math.max(gap, topUp));

			creates.push(payment);																			// stack the topUp Payment
			data.account.payment.push(payment);													// append to the Payment array
		}

		// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
		const active = this.getPayment(data, schedule.price, now.ts);	// determine which Payment record is active
		let amount = await this.member.getAmount(data);								// Account balance
		const payments = data.account.payment;												// the list of current and pre-paid Payments
		let activePay = payments[active];

		switch (active) {
			case 0:																											// Current payment is still Active
				if (!activePay[FIELD.effect])															// enable the Active Payment on first use
					updates.push({ ...activePay, [FIELD.effect]: stamp, expiry: calcExpiry(stamp, activePay, data.client) });

				if (amount.credit === schedule.price && schedule.price) 	// no funds left on Active Payment
					updates.push({ ...activePay, [FIELD.expire]: stamp });	// so, auto-close Payment (except $0 classes)

				break;

			default:																										// Future pre-payment is to become Active; rollover unused Funds
				for (let i = 0; i < active; i++)
					if (payments[i].approve && !payments[i][FIELD.expire])	// close previous Payment
						updates.push({ ...payments[i], [FIELD.expire]: stamp });

				updates.push({ ...activePay, [FIELD.effect]: stamp, bank: amount.funds, expiry: calcExpiry(stamp, activePay, data.client) });
				break;
		}

		// TODO:  also create a bonusTrack document
		// build the Attend document
		const attendDoc: Partial<IAttend> = {
			[FIELD.store]: STORE.attend,
			[FIELD.type]: schedule[FIELD.type],						// the type of Attend ('class','event','special')
			[FIELD.key]: schedule[FIELD.key] as TClass,		// the Attend's class
			[FIELD.stamp]: stamp,													// createDate
			[FIELD.date]: when,														// yyyymmdd of the Attend
			[FIELD.note]: note,														// optional 'note'
			schedule: schedule[FIELD.id],									// <id> of the Schedule
			payment: activePay[FIELD.id],									// <id> of Account's current active document
			amount: schedule.price,												// calculated price of the Attend
		}
		creates.push(attendDoc as TStoreBase);					// batch the new Attend

		return this.data.batch(creates, updates, undefined, SyncAttend)
			.then(_ => this.member.getAmount())						// re-calc the new Account summary
			.then(sum => this.data.writeAccount(sum))			// update Admin summary
	}
}