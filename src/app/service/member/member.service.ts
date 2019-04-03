import { Injectable } from '@angular/core';
import { timer } from 'rxjs';
import { debounce } from 'rxjs/operators';
import { Store, Actions, ofAction } from '@ngxs/store';

import { DBaseModule } from '@dbase/dbase.module';
import { getMemberInfo, calcExpiry } from '@service/member/member.library';
import { SnackService } from '@service/snack/snack.service';
import { StateService } from '@dbase/state/state.service';
import { SyncService } from '@dbase/sync/sync.service';
import { DataService } from '@dbase/data/data.service';
import { AttendService } from '@service/member/attend.service';

import { MemberInfo } from '@dbase/state/auth.action';
import { NewAttend } from '@dbase/state/state.action';
import { addWhere } from '@dbase/fire/fire.library';
import { FIELD, STORE } from '@dbase/data/data.define';
import { IProfilePlan, TPlan, IPayment, IProfileInfo, ISchedule, TStoreBase, IAttend, TClass, IStoreMeta } from '@dbase/data/data.schema';

import { DATE_FMT, getStamp, getDate } from '@lib/date.library';
import { isUndefined, isNull } from '@lib/type.library';
import { dbg } from '@lib/logger.library';

@Injectable({ providedIn: DBaseModule })
export class MemberService {
	private dbg = dbg(this);

	constructor(private readonly data: DataService, private readonly store: Store, private attend: AttendService,
		private state: StateService, private action: Actions, private snack: SnackService, private sync: SyncService) {
		this.dbg('new');

		this.action.pipe(															// special: listen for changes of the auth.info
			ofAction(MemberInfo),												// when MemberInfo is fired by AuthState (on user-login)
			debounce(_ => timer(2000)),									// wait a few seconds to have State settle
		).subscribe(_ => this.getAuthProfile());			// check to see if auth.info has changed.
		this.store.dispatch(new MemberInfo());				// now fire the initial MemberInfo check
	}

	async setPlan(plan: TPlan) {
		const doc = { [FIELD.store]: STORE.profile, [FIELD.type]: 'plan', plan } as IProfilePlan;
		this.dbg('plan: %j', doc);

		return this.data.insDoc(doc, undefined, 'plan')
			.catch(err => this.dbg('setPlan: %j', err.message))
	}

	/**
	 * Create a new TopUp payment
	 */
	async setPayment(amount?: number) {
		const data = await this.attend.getAccount();
		const price = data.client.price								// find the topUp price for this Member
			.filter(row => row[FIELD.type] === 'topUp')[0].amount || 0;

		return {
			[FIELD.id]: this.data.newId,
			[FIELD.store]: STORE.payment,
			[FIELD.type]: 'topUp',
			[FIELD.uid]: data.auth.current!.uid,
			amount: isUndefined(amount) ? price : amount,
		} as IPayment
	}

	/**
	 * get (or define a new) active Payment  
   * Determine if a new payment is due.  
   * -> if the price of the class is greater than their current funds  
   * -> if they've exceeded 99 Attends against the active Payment  
	 * -> if this check-in is later than the expiry-date
   * -> TODO: if their intro-pass has expired (auto bump them to 'member' plan)  
  */
	async getPayment(price: number, ts: number) {
		const data = await this.attend.getAccount();
		const summary = await this.attend.getAmount(data);
		const payments = data.account.payment;

		switch (true) {
			case data.account.attend.length > 99:
				return payments[1] || this.setPayment();									// more than 99-attendances against the activePayment

			case payments[0] && !payments[0][FIELD.effect]:
				return payments[0];																				// new account not-yet-activated

			case price > summary.funds:
				return payments[1] || this.setPayment();									// time for a new activePayment

			case payments[0].expiry && payments[0].expiry < ts:
				return payments[1] || this.setPayment();									// current Payment has expired

			default:
				return data.account.payment[0] || this.setPayment();
		}
	}

	/**
	 * Insert an Attendance record, matched to an <active> Account Payment  
	 */
	async setAttend(schedule: ISchedule, note?: string, date?: number) {
		const data = await this.attend.getAccount(date);	// get Member's current account details

		// If no <price> on Schedule, then lookup based on member's plan
		if (isUndefined(schedule.price))
			schedule.price = await this.attend.getEventPrice(schedule[FIELD.key], data);

		// if no <date>, then look back up-to 7 days to find when the Scheduled class was last offered
		if (isUndefined(date))
			date = await this.attend.lkpDate(schedule[FIELD.key], schedule.location);

		const now = getDate(date);
		const stamp = now.ts;
		const when = now.format(DATE_FMT.yearMonthDay);

		// check we are not re-booking same Class on same Day
		const attendFilter = [
			addWhere(FIELD.type, schedule[FIELD.key]),
			addWhere(FIELD.uid, data.auth.current!.uid),
			addWhere(FIELD.note, note),
			addWhere('date', when),
		]
		const booked = await this.data.getFire<IAttend>(STORE.attend, { where: attendFilter });
		if (booked.length) {
			this.snack.error('Already attended this class');
			return Promise.resolve(false);															// discard Attend
		}

		const creates: IStoreMeta[] = [];
		const updates: IStoreMeta[] = [];
		const payments = data.account.payment;												// the list of current and pre-paid Payments

		let activePay = await this.getPayment(schedule.price, now.ts);// determine which Payment record is active
		let amount = await this.attend.getAmount(data);								// Account balance

		switch (true) {
			// Current payment is still Active
			case payments[0] && payments[0][FIELD.id] === activePay[FIELD.id]:
				if (!activePay[FIELD.effect]) {
					activePay[FIELD.effect] = stamp;												// add effective date to Active Payment on first use
					activePay.expiry = calcExpiry(stamp, activePay, data);	// determine when this Payment will lapse
				}
				if (amount.credit === schedule.price && schedule.price) 	// no funds left on Active Payment (except $0 classes)
					activePay[FIELD.expire] = stamp;												// auto-close Payment
				updates.push({ ...activePay });														// add current account summary to Payment
				break;

			// Next pre-payment is to become Active; rollover unused Funds
			case payments[1] && payments[1][FIELD.id] === activePay[FIELD.id]:
				let idx = 1;
				updates.push({ [FIELD.expire]: stamp, ...payments[0] });
				do {
					updates.push({ ...activePay, [FIELD.effect]: stamp, bank: amount.funds, expiry: calcExpiry(stamp, payments[1], data) });
					data.account.summary.adjust -= amount.funds;
					amount = await this.attend.getAmount(data);							// calc new account summary
				} while (schedule.price > amount.funds) {
					idx += 1;
					updates.push({ ...activePay, [FIELD.expire]: stamp });	// expire the negative value
					activePay = payments[idx] || this.setPayment();
				};
				break;

			// New payment to become Active; rollover unused Funds
			default:
				if (payments[0])
					updates.push({ [FIELD.expire]: stamp, ...payments[0] });
				creates.push({ ...activePay, [FIELD.effect]: stamp, bank: amount.funds, expiry: calcExpiry(stamp, activePay, data) });
				break;
		}

		// build the Attend document
		// TODO:  also create a bonusTrack document
		const attendDoc: Partial<IAttend> = {
			[FIELD.store]: STORE.attend,
			[FIELD.type]: schedule[FIELD.type],						// the type of Attend ('class','event','special')
			[FIELD.key]: schedule[FIELD.key] as TClass,		// the Attend's class
			[FIELD.uid]: data.auth.current!.uid,					// the current User
			[FIELD.stamp]: stamp,													// createDate
			[FIELD.date]: when,														// yyyymmdd of the Attend
			[FIELD.note]: note,														// optional 'note'
			schedule: schedule[FIELD.id],									// <id> of the Schedule
			payment: activePay[FIELD.id],									// <id> of Account's current active document
			amount: schedule.price,												// calculated price of the Attend
		}
		creates.push(attendDoc as TStoreBase);					// batch the new Attend

		return new Promise((resolve, reject) => {
			this.sync.wait(NewAttend, _evt => {						// wait for NewAttend to fire
				return this.attend.getAmount()							// re-calc the new Account summary
					.then(sum => this.data.writeAccount(sum))	// update Admin summary
					.then(_ => resolve(true))
					.catch(err => reject(err.message))
			});

			this.data.batch(creates, updates)							// process the Payments / Attends
		})
	}

	/** check for change of User.additionalInfo */
	async getAuthProfile() {
		const user = await this.state.asPromise(this.state.getAuthData());
		if (isNull(user.auth.info) || isUndefined(user.auth.info))
			return;													// No AdditionalUserInfo available

		const memberInfo = getMemberInfo(user.auth.info);
		const profileInfo: Partial<IProfileInfo> = {
			...memberInfo,									// spread the conformed member info
			[FIELD.effect]: getStamp(),			// TODO: remove this when API supports local getMeta()
			[FIELD.store]: STORE.profile,
			[FIELD.type]: 'info',
		}

		const where = addWhere('providerId', user.auth.info.providerId);
		this.data.insDoc(profileInfo as IProfileInfo, where, Object.keys(memberInfo));
	}

}
