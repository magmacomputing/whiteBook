import { Injectable } from '@angular/core';
import { timer } from 'rxjs';
import { debounce, take } from 'rxjs/operators';
import { Store, Actions, ofAction } from '@ngxs/store';

import { SnackService } from '@service/snack/snack.service';
import { StateService } from '@dbase/state/state.service';
import { MemberInfo } from '@dbase/state/auth.action';
import { IAccountState } from '@dbase/state/state.define';

import { TWhere } from '@dbase/fire/fire.interface';
import { addWhere } from '@dbase/fire/fire.library';
import { getMemberInfo, lkpDate } from '@service/member/member.library';
import { FIELD, STORE } from '@dbase/data/data.define';
import { DataService } from '@dbase/data/data.service';
import { IProfilePlan, TPlan, IPayment, IProfileInfo, ISchedule, IClass, TStoreBase, IAttend, TClass } from '@dbase/data/data.schema';
import { DBaseModule } from '@dbase/dbase.module';

import { DATE_FMT, getStamp, getDate, TDate } from '@lib/date.library';
import { isUndefined, isNull } from '@lib/type.library';
import { dbg } from '@lib/logger.library';

@Injectable({ providedIn: DBaseModule })
export class MemberService {
	private dbg = dbg(this);

	constructor(private readonly data: DataService, private readonly store: Store, private state: StateService, private action: Actions, private snack: SnackService) {
		this.dbg('new');

		this.action.pipe(															// special: listen for changes of the auth.info
			ofAction(MemberInfo),												// when MemberInfo is fired by AuthState (on user-login)
			debounce(_ => timer(2000)),									// wait a couple of seconds to have State settle
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
	async setPayment(amount?: number, data?: IAccountState) {
		data = data || await this.getAccount();
		const price = data.member.price								// find the topUp price for this Member
			.filter(row => row[FIELD.type] === 'topUp')[0].amount || 0;

		return {
			[FIELD.id]: this.data.newId,
			[FIELD.store]: STORE.payment,
			[FIELD.type]: 'topUp',
			[FIELD.uid]: data.auth.user!.uid,
			amount: isUndefined(amount) ? price : amount,
		} as IPayment
	}

	/**
	 * get (or set a new) active Payment
	 */
	async getPayment(price: number, data?: IAccountState) {
		data = data || await this.getAccount();
		const summary = await this.getAmount(data);

		return (price > summary.credit)									// if not-enough in credit
			? this.setPayment()														// return a new Payment doc
			: data.account.payment[0]											// else return the current Payment doc
	}

	/**
	 * Insert an Attendance record, aligned to an <active> Account payment
	 */
	async setAttend(schedule: ISchedule, note?: string, date?: number, uid?: string) {
		const data = await this.getAccount(date, uid);	// get Member's current account details

		// If no <price> on Schedule, then lookup based on member's plan
		if (isUndefined(schedule.price))
			schedule.price = await this.getEventPrice(schedule[FIELD.key], data);

		// if no <date>, then look back up-to 7 days to find when the Scheduled class was last offered
		if (isUndefined(date))
			date = await lkpDate(this.state, schedule[FIELD.key], schedule.location, date)

		const base = getDate(date);
		const stamp = base.ts;
		const when = base.format(DATE_FMT.yearMonthDay);

		// check we are not re-booking same Class on same Day
		const attendFilter: TWhere = [
			addWhere(FIELD.type, schedule[FIELD.key]),
			addWhere(FIELD.uid, data.auth.user!.uid),
			addWhere('date', when),
		]
		if (note)
			attendFilter.push(addWhere(FIELD.note, note));
		const booked = await this.data.getAll<IAttend>(STORE.attend, { where: attendFilter });
		if (booked.length) {
			this.snack.error('Already attended this class');
			return;
		}

		const creates: TStoreBase[] = [];
		const updates: TStoreBase[] = [];
		const payments = data.account.payment;					// the list of current and prepaid payments

		// determine which Payment record is active
		const activePay = await this.getPayment(schedule.price, data);
		const amount = await this.getAmount(data);			// Account balance

		if (payments[0]) {
			if (payments[0][FIELD.id] !== activePay[FIELD.id]) {
				if (amount.credit)
					activePay.bank = amount.credit;						// rollover unused credit to new Payment
				creates.push(Object.assign({ [FIELD.effect]: stamp }, activePay));
				updates.push(Object.assign(payments[0], { [FIELD.expire]: stamp }));
			} else {
				if (!activePay[FIELD.effect])								// add effective date to Active Payment on first use
					updates.push(Object.assign(activePay, { [FIELD.effect]: stamp }));
			}
		}

		// build the Attend document
		const attendDoc: Partial<IAttend> = {
			[FIELD.store]: STORE.attend,
			[FIELD.type]: 'class',												// TODO: work out whether 'class' or 'event'
			[FIELD.key]: schedule[FIELD.key] as TClass,		// the Attend's class
			[FIELD.uid]: data.auth.user!.uid,							// the current User
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

	/** Current Account status */
	async getAccount(date?: TDate, uid?: string) {
		return this.state.getAccountData(date, uid)
			.pipe(take(1))
			.toPromise()
	}

	async getAmount(data?: IAccountState) {
		data = data || await this.getAccount();
		const { bank = 0, pend = 0, paid = 0, spend = 0 } = data.account.summary;
		return { bank, pend, paid, spend, credit: bank + pend + paid - spend };
	}

	async	getPlan(data?: IAccountState) {
		data = data || await this.getAccount();
		return data.member.plan[0];
	}

	// TODO: apply bonus-tracking to determine discount price
	async getEventPrice(event: string, data?: IAccountState) {
		data = data || (await this.getAccount());
		const profile = data.member.plan[0];						// the member's plan
		const span = await this.state.getSingle<IClass>(STORE.class, { fieldPath: FIELD.key, value: event });

		return data.member.price												// look in member's prices for a match in 'span' and 'plan'
			.filter(row => row[FIELD.type] === span[FIELD.type] && row[FIELD.key] === profile.plan)[0].amount || 0;
	}

	/** Determine the member's topUp amount */
	async getPayPrice(data?: IAccountState) {
		data = data || await this.getAccount();

		return data.member.price
			.filter(row => row[FIELD.type] === 'topUp')[0].amount || 0;
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

		const where: TWhere = { fieldPath: 'providerId', value: user.auth.info.providerId };
		this.data.insDoc(profileInfo as IProfileInfo, where, Object.keys(memberInfo));
	}

}
