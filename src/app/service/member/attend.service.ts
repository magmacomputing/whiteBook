import { Injectable } from '@angular/core';
import { combineLatest } from 'rxjs';
import { take } from 'rxjs/operators';

import { addWhere } from '@dbase/fire/fire.library';
import { StateService } from '@dbase/state/state.service';
import { sumPayment, sumAttend } from '@dbase/state/state.library';
import { SyncAttend } from '@dbase/state/state.action';
import { STORE, FIELD, BONUS } from '@dbase/data/data.define';

import { PAY, ATTEND } from '@service/member/attend.define';
import { calcBonus } from '@service/member/attend.library';
import { calcExpiry } from '@service/member/member.library';
import { MemberService } from '@service/member/member.service';
import { SnackService } from '@service/material/snack.service';
import { DBaseModule } from '@dbase/dbase.module';
import { TWhere } from '@dbase/fire/fire.interface';
import { DataService } from '@dbase/data/data.service';
import { IAttend, IStoreMeta, TClass, TStoreBase, ISchedule, IPayment, IGift, TBonus } from '@dbase/data/data.schema';

import { getDate, DATE_FMT, TDate } from '@lib/date.library';
import { isUndefined, isNumber, TString } from '@lib/type.library';
import { getPath, isEmpty, IObject } from '@lib/object.library';
import { asArray } from '@lib/array.library';
import { dbg } from '@lib/logger.library';

@Injectable({ providedIn: DBaseModule })
export class AttendService {
	private dbg = dbg(this);

	constructor(private member: MemberService, private state: StateService, private data: DataService, private snack: SnackService) { this.dbg('new'); }

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
				// .filter(row => row.start === now.format(DATE_FMT.HHMI)),	// TODO: match by time, in case offered multiple times in a day
				.filter(row => row[FIELD.key] === className)				// and match in 'class'
				.filter(row => row.location === location)						// and match in 'location'

			if (classes.length)																		// is this class offered on this 'day'   
				break;
			now = now.add(-1, 'day');															// else move pointer to previous day
		}

		if (ctr >= 7)																						// cannot find className on timetable
			now = getDate(date);																	// so default back to today's date	

		return now.ts;																					// timestamp
	}

	/** Determine the eligibility for free Attend */
	private getBonus = async (event: string, date?: TDate, elect?: string) => {
		// const now = getDate(date);
		// const uid = await this.data.auth.current
		// 	.then(user => user!.uid);															// the currently active User UID
		// const isMine = addWhere(FIELD.uid, uid);								// where-clause for current user
		// const prior = addWhere(`track.${FIELD.date}`, now.format(DATE_FMT.yearMonthDay), '<');

		// /**
		//  * uid is the Member to check-in 
		//  * gifts is array of active Gifts effective (not expired) on this date  
		//  * scheme is definition of active Bonus schemes effective on this date
		//  */
		// const [gifts, scheme] = await Promise.all([
		// 	this.data.getStore<IGift>(STORE.gift, isMine, date),	// any active Gifts

		// 	this.data.getStore<IBonus>(STORE.bonus, undefined, date)// any active Bonuses
		// 		.then(bonus => bonus.reduce((acc, row) => {
		// 			acc[row[FIELD.key]] = row;												// break out by Bonus key
		// 			return acc;
		// 		}, {} as IObject<IBonus>))
		// ]);

		// /**
		//  * attendGift		is array of Attends per row in gifts[]
		//  * attendWeek		is array of Attends so far this ISO week, less than <now>
		//  * attendMonth	is array of Attends so far this calendar month, less than <now>
		//  */
		// const [attendGift, attendWeek, attendMonth] = await Promise.all([		// get tracking data
		// 	Promise.all(																					// return an array of Attend per Gift
		// 		gifts.map(gift => this.data.getStore<IAttend>(STORE.attend, [isMine, addWhere(`bonus.${FIELD.id}`, gift[FIELD.id])]))
		// 	),
		// 	this.data.getStore<IAttend>(STORE.attend, [isMine, prior, addWhere('track.week', now.format(DATE_FMT.yearWeek))]),
		// 	this.data.getStore<IAttend>(STORE.attend, [isMine, prior, addWhere('track.month', now.format(DATE_FMT.yearMonth))]),
		// ]);

		// // We de-dup the Attends by date (yyyymmdd), as multiple attends on a single-day do not count towards a Bonus
		// let bonus = {} as TBonus;
		// const upd: IGift[] = [];																// an array of updates to Gifts
		// switch (true) {
		// 	/**
		// 	 * Admin adds 'Gift' records to a Member's account which will detail
		// 	 * the start-date, and count of free classes (and an optional expiry for the Gift).  
		// 	 * This bonus will be used in preference to any other bonus-pricing scheme.
		// 	 */
		// 	case gifts.length > 0																	// if Member has some open Gifts
		// 		&& (isUndefined(elect) || elect === BONUS.gift):		//   and has not elected to *skip* this Bonus

		// 		let curr = -1;																			// the Gift to use in determining eligibility
		// 		gifts.forEach((gift, idx) => {
		// 			if (attendGift[idx].length >= gifts[idx].count		// max number of Attends against this gift
		// 				|| (gifts[idx].expiry || 0) > now.ts)						// 	or this Gift expiry has passed
		// 				upd.push({ [FIELD.expire]: now.ts, ...gift })		// auto-expire it
		// 			else if (curr === -1) curr = idx;									// else found a Gift that might apply
		// 		})

		// 		if (curr !== -1) {
		// 			const attendCnt = attendGift[curr].length;				// how many Attends already against this Gift
		// 			const gift = gifts[curr];													// this is the Gift to book against
		// 			bonus = {
		// 				[FIELD.id]: gift[FIELD.id],											// Bonus id is the Gift Id
		// 				[FIELD.type]: BONUS.gift,												// Bonus type is 'gift'
		// 				count: attendCnt + 1,														// to help with tracking
		// 				desc: `${gifts[curr].count - attendCnt} gifts left`,
		// 				gift: [...upd, {
		// 					[FIELD.effect]: gift[FIELD.effect] || now.startOf('day').ts,
		// 					[FIELD.expire]: gift.count - attendCnt <= 1 ? now.ts : undefined,
		// 					...gift,
		// 				}],
		// 			}
		// 			break;																						// exit switch-case
		// 		}																										// drop through to next switch-case

		// 	/**
		// 	 * The Week scheme qualifies as a Bonus if the Member attends the required number of full-price or gift classes in a week (scheme.week.level).  
		// 	 * (even Gifts count towards a Bonus)
		// 	 * The Member must also have claimed less than the free limit (scheme.week.free) to enable this bonus
		// 	 */
		// 	case scheme.week
		// 		&& attendWeek																				// sum the non-Bonus -or- Gift Attends
		// 			.filter(row => isUndefined(row.bonus) || row.bonus[FIELD.type] === BONUS.gift)
		// 			.distinct(row => row.track[FIELD.date])						// de-dup by day-of-week
		// 			.length >= scheme.week.level											// must attend the 'level' number
		// 		&& attendWeek																				// sum the 'week' bonus claimed
		// 			.filter(row => row.bonus && row.bonus[FIELD.type] === BONUS.week)
		// 			.length < scheme.week.free												// must attend less than 'free' number
		// 		&& (isUndefined(elect) || elect === BONUS.week):		// if not skipped, then Bonus will apply

		// 		bonus = {
		// 			[FIELD.id]: scheme.week[FIELD.id],
		// 			[FIELD.type]: BONUS.week,
		// 			count: attendWeek.filter(row => row.bonus && row.bonus[FIELD.type] === BONUS.week).length + 1,
		// 			desc: scheme.week.desc,
		// 			gift: upd,
		// 		}
		// 		break;

		// 	/**
		// 	 * The Sunday scheme qualifies as a Bonus if the Member attends the required number of full-price classes in a week (scheme.sunday.level),
		// 	 * and did not qualify for the Week scheme previously (e.g. already claimed yesterday?).    
		// 	 * The class must be in the free list (scheme.week.free) to enable this bonus
		// 	 */
		// 	case scheme.sunday
		// 		&& attendWeek																				// count Attends this week either Gift or non-Bonus
		// 			.filter(row => isUndefined(row.bonus) || row.bonus[FIELD.type] === BONUS.gift)
		// 			.distinct(row => row.track[FIELD.date])						// de-dup by day-of-week
		// 			.length >= scheme.sunday.level										// required number of Attends this week
		// 		&& now.dow === Instant.DAY.Sun											// today is 'Sunday'
		// 		&& elect == BONUS.sunday														// Member elected to take Bonus
		// 		&& (scheme.sunday.free as TString).includes(event):	// Event is offered on Bonus

		// 		bonus = {
		// 			[FIELD.id]: scheme.sunday[FIELD.id],
		// 			[FIELD.type]: BONUS.sunday,
		// 			count: attendWeek.filter(row => row.bonus && row.bonus[FIELD.type] === BONUS.sunday).length + 1,
		// 			desc: scheme.sunday.desc,
		// 			gift: upd,
		// 		}
		// 		break;

		// 	/**
		// 	 * The Month scheme qualifies as a Bonus if the Member attends the required number of full-price classes in a month (scheme.month.level).  
		// 	 * The Member must also have attended less than the free limit (scheme.month.free) to enable this bonus
		// 	 */
		// 	case scheme.month
		// 		&& attendMonth
		// 			.filter(row => isUndefined(row.bonus) || row.bonus[FIELD.type] === BONUS.gift)
		// 			.distinct(row => row.track[FIELD.date])
		// 			.length >= scheme.month.level
		// 		&& attendMonth
		// 			.filter(row => row.bonus && row.bonus[FIELD.type] === BONUS.month)
		// 			.length < scheme.month.free
		// 		&& (isUndefined(elect) || elect === BONUS.month):

		// 		bonus = {
		// 			[FIELD.id]: scheme.month[FIELD.id],
		// 			[FIELD.type]: BONUS.month,
		// 			count: attendMonth.filter(row => row.bonus && row.bonus[FIELD.type] === BONUS.month).length + 1,
		// 			desc: scheme.month.desc,
		// 			gift: upd,
		// 		}
		// 		break;
		// }

		// return bonus;
	}

	/** Insert an Attend document, matched to an active Payment  */
	public setAttend = async (schedule: ISchedule, note?: TString, date?: TDate) => {
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

		// There is a bit of overlap in these Observables, but they serve different purposes
		let [data, source] = await combineLatest(
			this.state.getAccountData(date),								// get Member's current account details
			this.state.getScheduleData(date),								// get Schedule for this date
		)
			.pipe(take(1))																	// complete Observable after first emit
			.toPromise();																		// await first emit

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
			data.client.plan[0].bonus												// Plan is allowed to claim bonus?
				// ? calcBonus(schedule[FIELD.key], date, schedule.elect)// any bonus entitlement
				? calcBonus(source, schedule[FIELD.key], date)
				: {} as TBonus,
			this.member.getEventPrice(schedule[FIELD.key], data),
		]);

		if (!isEmpty(bonus)) {
			if (bonus.gift) {
				updates.push(...bonus.gift);									// batch the Gift updates
				delete bonus.gift;														// not needed
				delete bonus.desc;														// not needed
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
		// loop through Payments to determine which should be <active>
		let active: IPayment;															// Payment[0] is assumed active, by default

		while (true) {
			data = sumPayment(data);												// calc Payment summary
			data = sumAttend(data);													// deduct Attends against this Payment
			active = data.account.payment[0];								// current Payment
			const expiry = getPath<number>(active, 'expiry') || Number.MAX_SAFE_INTEGER;

			const tests: boolean[] = [];										// Set of test results
			tests[PAY.under_limit] = data.account.attend.length < ATTEND.maxColumn;
			tests[PAY.enough_funds] = schedule.price <= data.account.summary.funds;
			tests[PAY.not_expired] = now.ts <= expiry;
			if (!tests.includes(false))											// if tests do not include at-least one <false>
				break;																				// 	all tests passed; we have found a Payment

			this.dbg('limit: %j, %j', tests[PAY.under_limit], data.account.attend.length);
			this.dbg('funds: %j, %j, %j', tests[PAY.enough_funds], schedule.price, data.account.summary);
			this.dbg('expiry: %j, %j, %j', tests[PAY.not_expired], now.ts, expiry);

			// If over-limit (100+ Attends per Payment) but still have sufficient funds to cover this Class price,
			// 	insert an auto-approved $0 Payment (only if the next Attend is earlier than any future Payments)
			if (!tests[PAY.under_limit] && tests[PAY.enough_funds] /** && tests[PAY.not_expired] */) {
				if (data.account.payment.length <= 1 || stamp < data.account.payment[1].stamp) {
					const payment = await this.member.setPayment(0, stamp);
					payment.approve = { uid: ATTEND.autoApprove, stamp };

					creates.push(payment);											// stack the topUpPayment into the batch
					data.account.payment.splice(1, 0, payment);	// make this the 'next' Payment
				}
			}

			// If there are no future Payments, create a new Payment with the higher of
			// a. the usual topUp amount, or b. the amount needed to cover this Attend
			if (data.account.payment.length <= 1) {
				const gap = schedule.price - data.account.summary.credit;
				const topUp = Math.max(gap, await this.member.getPayPrice(data));
				const payment = await this.member.setPayment(topUp, stamp);

				creates.push(payment);												// stack the topUp Payment into the batch
				data.account.payment.push(payment);						// make this the 'next' Payment
			}

			const next = data.account.payment[1];
			if (next && !next.bank) {												// rollover unused funds into next Payment
				data.account.payment[1].bank = data.account.summary.funds;
				updates.push({ [FIELD.effect]: stamp, [FIELD.expire]: stamp, ...active });	// close previous Payment
				updates.push({ ...data.account.payment[1] });	// update the now-Active payment with <bank>

				data.account.payment = data.account.payment.slice(1);// drop the 1st, now-inactive payment
				data.account.attend = await this.data.getStore(STORE.attend, addWhere(`${STORE.payment}.${FIELD.id}`, next[FIELD.id]));
			}

			if (isUndefined(next)) {
				this.snack.error('Could not allocate a new Payment');
				throw new Error('Could not allocate a new Payment');
			}
		}																									// repeat the loop to test if this now-Active Payment is useable

		const upd: Partial<IPayment> = {};								// updates to the Payment
		if (!active[FIELD.effect])
			upd[FIELD.effect] = stamp;											// mark Effective on first check-in
		if (data.account.summary.funds === schedule.price && schedule.price)
			upd[FIELD.expire] = stamp;											// mark Expired if no funds (except $0 classes)
		if (!active.expiry && active.approve && isEmpty(bonus))	// calc an Expiry for this Payment
			upd.expiry = calcExpiry(active.approve.stamp, active, data.client);

		if (Object.keys(upd).length)											// changes to the active Payment
			updates.push({ ...active, ...upd });						// so, batch the Payment update

		// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
		// got everything we need; write an Attend document

		const attendDoc: Partial<IAttend> = {
			[FIELD.store]: STORE.attend,
			[FIELD.stamp]: stamp,														// createDate
			[FIELD.note]: note,															// optional 'note'
			timetable: {
				[FIELD.id]: schedule[FIELD.id],								// <id> of the Schedule
				[FIELD.key]: schedule[FIELD.key] as TClass,		// the Attend's class
				[FIELD.store]: schedule[FIELD.type] === 'class' ? STORE.schedule : STORE.calendar,
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
			bonus: !isEmpty(bonus) ? bonus : undefined,			// <id>/<type>/<count> of Bonus
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