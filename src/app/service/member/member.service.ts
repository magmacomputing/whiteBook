import { Injectable } from '@angular/core';
import { timer } from 'rxjs';
import { debounce, switchMapTo } from 'rxjs/operators';
import { Store, Actions, ofAction } from '@ngxs/store';

import { SnackService } from '@service/snack/snack.service';
import { StateService } from '@dbase/state/state.service';
import { MemberInfo } from '@dbase/state/auth.action';
import { addWhere } from '@dbase/fire/fire.library';
import { getMemberInfo, calcExpiry } from '@service/member/member.library';
import { AttendService } from '@service/member/attend.service';
import { FIELD, STORE } from '@dbase/data/data.define';
import { DataService } from '@dbase/data/data.service';
import { IProfilePlan, TPlan, IPayment, IProfileInfo, ISchedule, TStoreBase, IAttend, TClass } from '@dbase/data/data.schema';
import { DBaseModule } from '@dbase/dbase.module';

import { DATE_FMT, getStamp, getDate } from '@lib/date.library';
import { isUndefined, isNull } from '@lib/type.library';
import { dbg } from '@lib/logger.library';

@Injectable({ providedIn: DBaseModule })
export class MemberService {
	private dbg = dbg(this);

	constructor(private readonly data: DataService, private readonly store: Store, private attend: AttendService,
		private state: StateService, private action: Actions, private snack: SnackService) {
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
   * -> if their intro-pass has expired (auto bump them to 'member' plan)  
  */
	async getPayment(price: number) {
		const data = await this.attend.getAccount();
		const summary = await this.attend.getAmount(data);

		switch (true) {
			// more than 99-attendances against the activePayment
			case data.account.attend.length > 99:
				return data.account.payment[1] || this.setPayment();

			// new account not-yet-activated
			case data.account.payment[0] && !data.account.payment[0][FIELD.effect]:
				return data.account.payment[0];

			// time for a new activePayment
			case price > summary.funds:
				return data.account.payment[1] || this.setPayment();

			default:
				return data.account.payment[0] || this.setPayment();
		}
	}

	/**
	 * Insert an Attendance record, matched to an <active> Account Payment,  
	 * else create new Payment as well
	 */
	async setAttend(schedule: ISchedule, note?: string, date?: number) {
		const data = await this.attend.getAccount(date);	// get Member's current account details

		// If no <price> on Schedule, then lookup based on member's plan
		if (isUndefined(schedule.price))
			schedule.price = await this.attend.getEventPrice(schedule[FIELD.key], data);

		// if no <date>, then look back up-to 7 days to find when the Scheduled class was last offered
		if (isUndefined(date))
			date = await this.attend.lkpDate(schedule[FIELD.key], schedule.location, date)

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
			return;
		}

		const creates: TStoreBase[] = [];
		const updates: TStoreBase[] = [];
		const payments = data.account.payment;						// the list of current and prepaid payments

		// determine which Payment record is active
		const activePay = await this.getPayment(schedule.price);
		const amount = await this.attend.getAmount(data);	// Account balance

		// TODO: dont set early <expire> when plan === 'gratis'
		switch (true) {
			// Current payment is still Active
			case payments[0] && payments[0][FIELD.id] === activePay[FIELD.id]:
				if (!activePay[FIELD.effect])									// add effective date to Active Payment on first use
					updates.push({ [FIELD.effect]: stamp, expiry: calcExpiry(stamp, payments[0].amount, data), ...payments[0] });
				if (amount.credit === schedule.price && schedule.price) 				// no funds left on Active Payment
					updates.push({ [FIELD.expire]: stamp, ...payments[0] });
				if (payments[1] && payments[1][FIELD.type] === 'debit' && payments[1].approve && amount.credit === schedule.price) {
					updates.push({ [FIELD.expire]: stamp, ...payments[0] });
					updates.push({ [FIELD.effect]: payments[1].stamp, [FIELD.expire]: payments[1].approve.stamp, ...payments[1] });
				}
				break;

			// Next pre-payment is to become Active, rollover unused Funds
			case payments[1] && payments[1][FIELD.id] === activePay[FIELD.id]:
				updates.push({ [FIELD.expire]: stamp, ...payments[0] });
				updates.push({ [FIELD.effect]: stamp, bank: amount.funds, expiry: calcExpiry(stamp, payments[1].amount, data), ...payments[1] });
				if (payments[2] && payments[2][FIELD.type] === 'debit' && payments[2].approve && amount.credit === schedule.price) {
					updates.push({ [FIELD.expire]: stamp, ...payments[1] });
					updates.push({ [FIELD.effect]: payments[2].stamp, [FIELD.expire]: payments[2].approve.stamp, ...payments[2] });
				}
				break;

			// New payment to become Active, rollover unused Funds
			default:
				updates.push({ [FIELD.expire]: stamp, ...payments[0] });
				creates.push({ [FIELD.effect]: stamp, bank: amount.funds, expiry: calcExpiry(stamp, activePay.amount, data), ...activePay });
				break;
		}

		// build the Attend document
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
		creates.push(attendDoc as TStoreBase);

		// TODO:  also create a bonusTrack document
		return this.data.batch(creates, updates);
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
