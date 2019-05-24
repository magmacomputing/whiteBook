import { Injectable } from '@angular/core';

import { addWhere } from '@dbase/fire/fire.library';
import { StateService } from '@dbase/state/state.service';
import { sumPayment, sumAttend } from '@dbase/state/state.library';
import { SyncAttend } from '@dbase/state/state.action';
import { STORE, FIELD, BONUS } from '@dbase/data/data.define';

import { calcExpiry } from '@service/member/member.library';
import { MemberService } from '@service/member/member.service';
import { SnackService } from '@service/material/snack.service';
import { DBaseModule } from '@dbase/dbase.module';
import { TWhere } from '@dbase/fire/fire.interface';
import { DataService } from '@dbase/data/data.service';
import { IAttend, IStoreMeta, TClass, TStoreBase, ISchedule, IPayment, IGift, IBonus, TBonus } from '@dbase/data/data.schema';

import { getDate, DATE_FMT, TDate, Instant } from '@lib/date.library';
import { isUndefined, isNumber, TString } from '@lib/type.library';
import { getPath, isEmpty, IObject } from '@lib/object.library';
import { asArray } from '@lib/array.library';
import { dbg } from '@lib/logger.library';

@Injectable({ providedIn: DBaseModule })
export class AttendService {
	private dbg = dbg(this);

	constructor(private member: MemberService, private state: StateService, private data: DataService, private snack: SnackService) { this.dbg('new'); }

	/** look back up-to-seven days to find when className was last scheduled */
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
	async getBonus(event: string, date?: TDate, elect?: string) {
		/**
		 * uid is the Member to check-in 
		 * gifts is array of active Gifts effective (not expired) on this date  
		 * scheme is definition of active Bonus schemes effective on this date
		 */
		const [uid, gifts, scheme] = await Promise.all([
			this.data.auth.current
				.then(user => user!.uid),

			this.data.getStore<IGift>(STORE.gift, undefined, date),					// any active Gifts

			this.data.getStore<IBonus>(STORE.bonus, undefined, date)				// any active Bonuses
				.then(bonus => bonus.reduce((acc, row) => {
					acc[row[FIELD.key]] = row;
					return acc;
				}, {} as IObject<IBonus>))
		]);

		/**
		 * attendGift		is array of Attends so far against 1st active Gift
		 * attendWeek		is array of Attends so far in the week, less than <now>
		 * attendMonth	is array of Attends so far in the month, less than <now>
		 */
		const now = getDate(date);
		const where = addWhere(FIELD.uid, uid);
		const prior = addWhere(`track.${FIELD.date}`, now.format(DATE_FMT.yearMonthDay), '<');
		const [attendGift, attendWeek, attendMonth] = await Promise.all([		// get tracking data
			this.data.getStore<IAttend>(STORE.attend, [where, addWhere(`bonus.${FIELD.id}`, (gifts[0] || {})[FIELD.id])]),
			this.data.getStore<IAttend>(STORE.attend, [where, addWhere('track.week', now.format(DATE_FMT.yearWeek)), prior]),
			this.data.getStore<IAttend>(STORE.attend, [where, addWhere('track.month', now.format(DATE_FMT.yearMonth)), prior]),
		]);

		// We de-dup the Attends by date (yyyymmdd), as multiple attends on a single-day do not count towards a Bonus
		let bonus = {} as TBonus;
		switch (true) {
			/**
			 * Admin adds 'Gift' records to a Member's account which will detail
			 * the start-date, and count of free classes (and an optional expiry for the Gift).  
			 * This bonus will be used in preference to any other bonus-pricing scheme.
			 */
			case gifts.length > 0:														// qualify for a Gift bonus?
				const close = attendGift.length >= gifts[0].count
					|| (gifts[0].expiry && gifts[0].expiry > now.ts);	// TODO: check for future Gifts, if this is now expired
				bonus = close																		// close a Gift
					? { gift: { [FIELD.expire]: now.ts, ...gifts[0] } }
					: {
						[FIELD.id]: gifts[0][FIELD.id],
						[FIELD.type]: BONUS.gift,
						count: attendGift.length + 1,
						gift: {
							[FIELD.effect]: gifts[0][FIELD.effect] || (attendGift.length === 0 ? now.startOf('day').ts : undefined),
							[FIELD.expire]: gifts[0].count - attendGift.length <= 1 ? now.ts : undefined,
							...gifts[0],
						},
					}
				break;

			/**
			 * The Week scheme qualifies as a Bonus if the Member attends the required number of full-price or gift classes in a week (scheme.week.level).  
			 * The Member must also have attended less than the free limit (scheme.week.free) to claim this bonus
			 */
			case scheme.week
				&& attendWeek
					.filter(row => isUndefined(row.bonus) || row.bonus[FIELD.type] === BONUS.gift)
					.distinct(row => row.track[FIELD.date])
					.length + 1 > scheme.week.level
				&& attendWeek
					.filter(row => row.bonus === scheme.week[FIELD.id])
					.distinct(row => row.track[FIELD.date])
					.length < scheme.week.free:
				bonus = {
					[FIELD.id]: scheme.week[FIELD.id],
					[FIELD.type]: BONUS.week,
				}
				break;

			/**
			 * The Sunday scheme qualifies as a Bonus if the Member attends the required number of full-price classes in a week (scheme.sunday.level),
			 * and does not qualify for the Week scheme (already claimed yesterday?).    
			 * The class must be in the free list (scheme.week.free) to claim this bonus
			 */
			case scheme.sunday
				&& attendWeek																				// count Attends this week either Gift or non-Bonus
					.filter(row => isUndefined(row.bonus) || row.bonus[FIELD.type] === BONUS.gift)
					// .distinct(row => row.track[FIELD.date])				// de-dup by day-of-week
					.length + 1 > scheme.sunday.level									// required number of Attends this week
				&& now.dow === Instant.DAY.Sun											// today is 'Sunday'
				&& elect == BONUS.sunday														// Member elected to take Bonus
				&& (scheme.sunday.free as TString).includes(event):	// Event is offered on Bonus
				bonus = {
					[FIELD.id]: scheme.sunday[FIELD.id],
					[FIELD.type]: BONUS.sunday,
				}
				break;

			/**
			 * The Month scheme qualifies as a Bonus if the Member attends the required number of full-price classes in a month (scheme.month.level).  
			 * The Member must also have attended less than the free limit (scheme.month.free) to claim this bonus
			 */
			case scheme.month
				&& attendMonth
					.filter(row => isUndefined(row.bonus) || row.bonus[FIELD.type] === BONUS.gift)
					.distinct(row => row.track[FIELD.date])
					.length + 1 > scheme.month.level
				&& attendMonth
					.filter(row => row.bonus === scheme.month[FIELD.id])
					.distinct(row => row.track[FIELD.date])
					.length < scheme.month.free:
				bonus = {
					[FIELD.id]: scheme.month[FIELD.id],
					[FIELD.type]: BONUS.month,
				}
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
		// This presumes that the <key> is from schedule store, and not calendar
		if (isUndefined(date))
			date = await this.lkpDate(schedule[FIELD.key], schedule.location);
		const now = getDate(date);
		const stamp = now.ts;
		const when = now.format(DATE_FMT.yearMonthDay);

		let data = await this.member.getAccount(date);		// get Member's current account details

		// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
		// check we are not re-booking same Class on same Day at same Location at same Time
		const attendFilter = [
			addWhere(`track.${FIELD.date}`, when),
			addWhere(`timetable.${FIELD.key}`, schedule[FIELD.key]),
			addWhere(`timetable.${FIELD.id}`, schedule[FIELD.id]),// schedule has <location>, <instructor>, <startTime>
			addWhere(FIELD.uid, data.auth.current!.uid),
			addWhere(FIELD.note, note),
		]
		const booked = await this.data.getStore<IAttend>(STORE.attend, attendFilter);
		if (booked.length) {
			this.dbg(`Already attended ${schedule[FIELD.key]} on ${now.format(DATE_FMT.display)}`);
			this.snack.error(`Already attended ${schedule[FIELD.key]} on ${now.format(DATE_FMT.display)}`);
			return false;																		// discard Attend
		}

		// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
		// work out the actual price to charge
		let [bonus, calcPrice] = await Promise.all([
			data.client.plan[0].bonus
				? this.getBonus(schedule[FIELD.key], date, schedule.elect)// any bonus entitlement
				: {} as TBonus,
			this.member.getEventPrice(schedule[FIELD.key], data),
		]);

		if (!isEmpty(bonus)) {
			if (bonus.gift) {
				updates.push({ ...bonus.gift });							// batch the Gift update
				delete bonus.gift;														// not needed
			}
			if (bonus[FIELD.id])
				calcPrice = 0;																// override calculated price
		}

		if (!isUndefined(schedule.price) && schedule.price !== calcPrice) {// calculation mis-match
			this.dbg('bonus: %j', bonus);
			this.snack.error(`Price discrepancy: paid ${schedule.price}, but should be ${calcPrice}`);
			throw new Error(`Price discrepancy: paid ${schedule.price}, but should be ${calcPrice}`);
		}
		schedule.price = calcPrice;

		// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
		// loop through Payments to determine which is <active>
		const tests = new Set<boolean>();									// Set of test results
		let active: IPayment;															// Payment[0]

		while (true) {
			data = sumPayment(data);												// calc Payment summary
			data = sumAttend(data);													// deduct Attends against this Payment
			active = data.account.payment[0];								// current Payment
			const expiry = getPath<number>(active, 'expiry') || Number.MAX_SAFE_INTEGER;

			tests.add(data.account.attend.length < 100);						// arbitrary limit of Attends against a Payment             
			tests.add(schedule.price <= data.account.summary.funds);// enough funds to cover this Attend
			tests.add(now.ts < expiry);															// Payment expired
			if (!tests.has(false))
				break;																				// all tests passed
			tests.clear();																	// reset the test Set
			this.dbg('limit: %j, %j', data.account.attend.length < 100, data.account.attend.length);
			this.dbg('funds: %j, %j, %j', schedule.price <= data.account.summary.funds, schedule.price, data.account.summary);
			this.dbg('expiry: %j, %j, %j', now.ts < expiry, now.ts, expiry);

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
				updates.push({ [FIELD.effect]: stamp, [FIELD.expire]: stamp, ...active });	// close previous Payment
				updates.push({ ...data.account.payment[1] });	// update the now-Active payment with <bank>

				data.account.payment = data.account.payment.slice(1);// drop the 1st, now-inactive payment
				data.account.attend = await this.data.getStore(STORE.attend, addWhere(`${STORE.payment}.${FIELD.id}`, next[FIELD.id]));
			}
		}

		const upd: Partial<IPayment> = {};								// updates to the Payment
		if (!active[FIELD.effect])
			upd[FIELD.effect] = stamp;											// mark Effective on first check-in
		if (data.account.summary.funds === schedule.price && schedule.price)
			upd[FIELD.expire] = stamp;											// mark Expired if no funds (except $0 classes)
		if (!active.expiry && active.approve)							// calc an Expiry for this Payment
			upd.expiry = calcExpiry(active.approve.stamp, active, data.client);

		if (Object.keys(upd).length)
			updates.push({ ...active, ...upd });						// batch the Payment update

		// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
		// got everything we need; write an Attend document
		const attendDoc: Partial<IAttend> = {
			[FIELD.store]: STORE.attend,
			[FIELD.stamp]: stamp,														// createDate
			[FIELD.note]: note,															// optional 'note'
			timetable: {
				[FIELD.id]: schedule[FIELD.id],								// <id> of the Schedule
				[FIELD.key]: schedule[FIELD.key] as TClass,		// the Attend's class
				[FIELD.store]: schedule[FIELD.type] === 'class' ? 'schedule' : 'calendar',
				[FIELD.type]: schedule[FIELD.type],						// the type of Attend ('class','event','special')
			},
			payment: {
				[FIELD.id]: active[FIELD.id],									// <id> of Account's current active document
				amount: schedule.price,												// calculated price of the Attend
			},
			track: {
				[FIELD.date]: when,														// yyyymmdd of the Attend
				day: now.dow,																	// day of week
				week: now.format(DATE_FMT.yearWeek),					// week-number of year
				month: now.format(DATE_FMT.yearMonth),				// month-number of year
			},
			bonus: !isEmpty(bonus) ? bonus : undefined,			// <id>/<type> of Bonus
		}
		creates.push(attendDoc as TStoreBase);						// batch the new Attend

		data.account.attend.push(attendDoc as IAttend);
		await this.member.setAccount(creates, updates, data);

		return this.data.batch(creates, updates, undefined, SyncAttend)
	}

	/**
	 * Removing Attends is a tricky business...  
	 * it may need to walk back a couple of related Documents.  
	 * Take great care when deleting a non-latest Attend, as this will affect Bonus pricing, Gift tracking, Bank rollovers, etc.
	 */
	public delAttend = async (where: TWhere) => {
		const memberUid = addWhere(FIELD.uid, (await this.data.auth.current)!.uid);
		const filter = asArray(where);
		if (!filter.map(clause => clause.fieldPath).includes(FIELD.uid))
			filter.push(memberUid);

		const [attends, payments, gifts] = await Promise.all([
			this.data.getStore<IAttend>(STORE.attend, filter),
			this.data.getStore<IPayment>(STORE.payment, [memberUid, addWhere(FIELD.store, STORE.payment)]),
			this.data.getStore<IGift>(STORE.gift, [memberUid, addWhere(FIELD.store, STORE.gift)]),
		])
		const creates: IStoreMeta[] = [];
		const updates: IStoreMeta[] = [];
		const deletes: IStoreMeta[] = [...attends];

		let pays = attends														// count the number of Attends per Payment
			.distinct(row => row.payment[FIELD.id])
			.reduce((acc, itm) => {
				acc[itm] = payments.filter(row => row[FIELD.id] === itm).length;
				return acc;
			}, {} as IObject<number>);

		attends.forEach(attend => {
			if (attend.bonus && attend.bonus[FIELD.type] === BONUS.gift) {
				const idx = gifts.findIndex(row => row[FIELD.id] === attend.bonus![FIELD.id]!);
				if (idx >= 0 && isNumber(gifts[idx][FIELD.expire])) {
					gifts[idx][FIELD.expire] = undefined;
					updates.push({ ...gifts[idx] });				// re-open a Gift
				}
			}

			const payId = attend.payment[FIELD.id];			// get the Payment id
			pays[payId] -= 1;														// reduce the number of Attends for this Payment
			if (pays[payId] === 0) {
				const idx = payments.findIndex(row => row[FIELD.id] === payId);
				if (idx > 0) {														// re-open a Payment
					payments[idx][FIELD.expire] = undefined;
					payments[idx].bank = undefined;
					updates.push({ ...payments[idx] })
				}
			}

		})

		return this.data.batch(creates, updates, deletes)
			.then(_ => this.member.updAccount())
	}
}