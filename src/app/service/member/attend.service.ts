import { Injectable } from '@angular/core';

import { asAt } from '@dbase/library/app.library';
import { addWhere } from '@dbase/fire/fire.library';
import { StateService } from '@dbase/state/state.service';
import { sumPayment, sumAttend } from '@dbase/state/state.library';
import { SyncAttend } from '@dbase/state/state.action';
import { STORE, FIELD } from '@dbase/data/data.define';

import { calcExpiry } from '@service/member/member.library';
import { MemberService } from '@service/member/member.service';
import { SnackService } from '@service/snack/snack.service';
import { DBaseModule } from '@dbase/dbase.module';
import { DataService } from '@dbase/data/data.service';
import { IAttend, IStoreMeta, TClass, TStoreBase, ISchedule, IPayment, IGift, IBonus } from '@dbase/data/data.schema';

import { getDate, DATE_FMT, TDate, Instant } from '@lib/date.library';
import { isUndefined, TString } from '@lib/type.library';
import { getPath } from '@lib/object.library';
import { dbg } from '@lib/logger.library';

@Injectable({ providedIn: DBaseModule })
export class AttendService {
	private dbg = dbg(this);

	constructor(private member: MemberService, private state: StateService, private data: DataService, private snack: SnackService) { this.dbg('new') }

	/** loop back up-to-seven days to find when className was last scheduled */
	lkpDate = async (className: string, location?: string, date?: TDate) => {
		const timetable = await this.state.getTimetableData(date).toPromise();
		let now = getDate(date);													// start with date-argument
		let ctr = 0;

		if (!location)
			location = this.state.getDefault(timetable, STORE.location);

		for (ctr; ctr < 7; ctr++) {
			const classes = timetable.client.schedule!			// loop through schedule
				.filter(row => row.day === now.dow)						// finding a match in 'day'
				// .filter(row => row.start === now.format(DATE_FMT.HHMI)),	// TODO: match by time, in case offered multiple times
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
	 * Determine the eligibility for free Attend
	 */
	async getBonus(event: string, uid?: string, date?: TDate) {
		const now = getDate(date);
		let bonus = {} as IBonus | IGift;
		uid = uid || await this.data.auth.current.then(auth => auth!.uid);

		/**
		 * gift is array of Gifts effective (not expired) on this date
		 * scheme is definition of Bonus schemes effective on this date
		 */
		let [gift, scheme] = await Promise.all([
			this.data.getStore<IGift>(STORE.gift, undefined, date)					// any active Gifts
				.then(gifts => asAt(gifts, undefined, date)),									// effective on this date
			this.data.getStore<IBonus>(STORE.bonus, undefined, date)				// any active Bonuses
				.then(bonus => ({
					'week': bonus.find(row => row[FIELD.key] === 'week') || {} as IBonus,
					'month': bonus.find(row => row[FIELD.key] === 'month') || {} as IBonus,
					'sunday': bonus.find(row => row[FIELD.key] === 'sunday') || {} as IBonus,
				}))
		]);

		/**
		 * bonusGift	is array of Attends so far against 1st available Gift
		 * attendWeek	is array of Attends so far in the current week
		 * attendMonth is array of Attends so far in the current month
		 */
		const where = addWhere(FIELD.uid, uid);
		const [bonusGift, attendWeek, attendMonth] = await Promise.all([		// get tracking data
			this.data.getStore<IAttend>(STORE.attend, [where, addWhere('bonus', (gift[0] || {})[FIELD.id])]),
			this.data.getStore<IAttend>(STORE.attend, [where, addWhere('track.week', now.format(DATE_FMT.yearWeek))]),
			this.data.getStore<IAttend>(STORE.attend, [where, addWhere('track.month', now.format(DATE_FMT.yearMonth))]),
		]);

		// We de-dup the Attends by date (yyyymmdd), as multiple attends on a day do not count towards a Bonus
		switch (true) {
			/**
			 * Admin adds 'Gift' records to a Member's account which will detail
			 * the start-date, and count of free classes (and an optional expiry for the Gift).  
			 * This bonus will be used in preference to any other bonus-pricing scheme.
			 */
			case !!gift.length:																// qualify for a Gift bonus?
				bonus = gift[0];																// use 1st effective Gift as the Bonus
				if (bonusGift.length + 1 >= bonus.count)
					bonus[FIELD.expire] = now.ts;									// mark this gift as 'now complete'
				break;

			/**
			 * The Week scheme qualifies as a Bonus if the Member attends the required number of full-price classes in a week (scheme.week.level).  
			 * The Member must also have attended less than the free limit (scheme.week.free) to claim this bonus
			 */
			case scheme.week
				&& attendWeek.filter(row => isUndefined(row.bonus)).distinct(row => row.date).length + 1 > scheme.week.level
				&& attendWeek.filter(row => row.bonus === scheme.week[FIELD.id]).distinct(row => row.date).length < scheme.week.free:
				bonus = scheme.week;
				break;

			/**
			 * The Sunday scheme qualifies as a Bonus if the Member attends the required number of full-price classes in a week (scheme.sunday.level),
			 * but does not qualify for the Week scheme (already claimed yesterday?).    
			 * The class must be in the free list (scheme.week.free) to claim this bonus
			 */
			case scheme.sunday
				&& attendWeek.filter(row => isUndefined(row.bonus)).distinct(row => row.date).length + 1 > scheme.sunday.level
				&& now.dow === Instant.DAY.Sun
				&& (scheme.sunday.free as TString).includes(event):
				bonus = scheme.sunday;
				break;

			/**
			 * The Month scheme qualifies as a Bonus if the Member attends the required number of full-price classes in a month (scheme.month.level).  
			 * The Member must also have attended less than the free limit (scheme.month.free) to claim this bonus
			 */
			case scheme.month
				&& attendMonth.filter(row => isUndefined(row.bonus)).distinct(row => row.date).length + 1 > scheme.month.level
				&& attendMonth.filter(row => row.bonus === scheme.month[FIELD.id]).distinct(row => row.date).length < scheme.month.free:
				bonus = scheme.month;
				break;
		}

		return bonus;
	}

	/**
	 * Insert an Attend document, matched to an active Payment  
	 */
	async setAttend(schedule: ISchedule, note?: TString, date?: TDate) {
		const creates: IStoreMeta[] = [];
		const updates: IStoreMeta[] = [];

		// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
		// if no <date>, then look back up-to 7 days to find when the Scheduled class was last offered
		if (isUndefined(date))
			date = await this.lkpDate(schedule[FIELD.key], schedule.location);
		const now = getDate(date);
		const stamp = now.ts;
		const when = now.format(DATE_FMT.yearMonthDay);

		let data = await this.member.getAccount(date);		// get Member's current account details
		const uid = data.auth.current!.uid;

		// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
		// check we are not re-booking same Class on same Day at same Location at same Time
		const attendFilter = [
			addWhere(FIELD.uid, data.auth.current!.uid),
			addWhere(FIELD.key, schedule[FIELD.key]),
			addWhere(FIELD.note, note),
			addWhere('schedule', schedule[FIELD.id]),				// schedule has <location>, <instructor>, <startTime>
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
		// work out the actual price to charge
		let [bonus, calcPrice] = await Promise.all([
			data.client.plan[0].bonus
				? this.getBonus(schedule[FIELD.key], uid, date)// any bonus entitlement
				: {} as IBonus,
			this.member.getEventPrice(schedule[FIELD.key], data),
		]);

		if (bonus[FIELD.id]) {														// if an applicable Bonus was found,
			calcPrice = 0;																	// this Attend is free
			if ((<IGift>bonus).count)
				updates.push(bonus);													// update Gift date-range
		}

		if (schedule.price !== calcPrice && now.yy > 2014)// calculation mis-match
			throw new Error(`Price discrepancy: wanted ${schedule.price}, should be ${calcPrice}`);

		schedule.price = calcPrice;

		// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
		// loop through Payments to determine which is <active>
		const tests = new Set<boolean>();									// Set of test results
		let active: IPayment;															// Payment[0]

		while (true) {
			data = sumPayment(data);												// calc Payment summary
			data = sumAttend(data);													// deduct Attends against this Payment
			active = data.account.payment[0];								// current Payment
			const expiry = getPath(active, 'expiry') || Number.MAX_SAFE_INTEGER;

			tests.add(data.account.attend.length < 100);						// arbitrary limit of Attends against a Payment             
			tests.add(schedule.price <= data.account.summary.funds);// enough funds to cover this Attend
			tests.add(now.ts < expiry);															// Payment expired

			if (!tests.has(false))
				break;																				// all tests passed
			tests.clear();																	// reset the test Set
			this.dbg('test1: %j, %j', data.account.attend.length < 100, data.account.attend.length);
			this.dbg('test2: %j, %j, %j', schedule.price <= data.account.summary.funds, schedule.price, data.account.summary);
			this.dbg('test3: %j, %j, %j', now.ts < expiry, now.ts, expiry);

			if (data.account.payment.length <= 1) {					// create a new Payment
				const gap = schedule.price - data.account.summary.credit;
				const topUp = await this.member.getPayPrice(data);
				const payment = await this.member.setPayment(Math.max(gap, topUp));

				if (topUp === 0)
					payment.approve = { uid: 'Auto-Approve', stamp: now.ts }

				creates.push(payment);												// stack the topUp Payment into the batch
				data.account.payment.push(payment);						// append to the Payment array
			}

			const next = data.account.payment[1];
			if (next && !next.bank) {												// rollover unused funds into next Payment
				data.account.payment[1].bank = data.account.summary.funds;
				updates.push({ ...data.account.payment[1] });

				if (active.approve)															// close previous Payment
					updates.push({ [FIELD.effect]: stamp, [FIELD.expire]: stamp, ...active });

				data.account.payment = data.account.payment.slice(1);// drop the 1st inactive payment
				data.account.attend = await this.data.getStore(STORE.attend, addWhere(STORE.payment, next[FIELD.id]));
			}
		}

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
			bonus: bonus[FIELD.id],													// <id> of the Bonus
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