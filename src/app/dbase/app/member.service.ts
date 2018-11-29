import { Injectable } from '@angular/core';

import { timer } from 'rxjs';
import { debounce, take } from 'rxjs/operators';
import { Store, Actions, ofAction } from '@ngxs/store';

import { StateService } from '@dbase/state/state.service';
import { IAuthState, LoginInfo } from '@dbase/state/auth.define';
import { AuthState } from '@dbase/state/auth.state';

import { TWhere } from '@dbase/fire/fire.interface';
import { getMemberInfo } from '@dbase/app/member.library';
import { FIELD, STORE } from '@dbase/data/data.define';
import { DataService } from '@dbase/data/data.service';
import { IProfilePlan, TPlan, IPayment, IProfileInfo, ISchedule, IClass, TStoreBase, IAttend, TClass } from '@dbase/data/data.schema';
import { DBaseModule } from '@dbase/dbase.module';

import { getStamp, fmtDate, DATE_KEY } from '@lib/date.library';
import { isUndefined, isNull } from '@lib/type.library';
import { dbg } from '@lib/logger.library';
import { IAccountState } from '@dbase/state/state.define';
import { initTransferState } from '@angular/platform-browser/src/browser/transfer_state';

@Injectable({ providedIn: DBaseModule })
export class MemberService {
	private dbg: Function = dbg.bind(this);

	constructor(private readonly data: DataService, private readonly store: Store, private state: StateService, private action: Actions) {
		this.dbg('new');

		this.action.pipe(															// special: listen for changes of the auth.info
			ofAction(LoginInfo),												// when LoginInfo is fired by AuthState (on user-login)
			debounce(_ => timer(2000)),									// wait a couple of seconds to have State settle
		).subscribe(_ => this.getAuthProfile());			// check to see if auth.info has changed.
		this.store.dispatch(new LoginInfo());					// now fire an initial LoginInfo check
	}

	async setPlan(plan: TPlan) {
		const doc = { [FIELD.store]: STORE.profile, [FIELD.type]: 'plan', plan } as IProfilePlan;

		this.dbg('plan: %j', doc);
		return this.data.insDoc(doc, undefined, 'plan')
			.catch(err => this.dbg('setPlan: %j', err.message))
	}

	/** Create a new TopUp payment */
	async setPayment(amount?: number, data?: IAccountState) {
		data = data || await this.getAccount();
		const price = data.member.price
			.filter(row => row[FIELD.type] === 'topUp')[0].amount || 0;

		return {
			[FIELD.id]: this.data.newId,
			[FIELD.store]: STORE.payment,
			[FIELD.type]: 'topUp',
			[FIELD.uid]: data.auth.user!.uid,
			amount: isUndefined(amount) ? price : amount,
		} as IPayment
	}

	/** get (or set a new) active Payment */
	async getPayment(price: number, data?: IAccountState) {
		data = data || await this.getAccount();
		const summary = await this.getAmount(data);

		return (price > summary.credit)									// if not-enough in credit
			? this.setPayment()														// return a new Payment doc
			: data.account.payment[0]											// else return the current Payment doc
	}

	// TODO: determine <date> as the last occurrence of the <time>'s class
	/** Insert an Attendance record, aligned to an <active> Account payment */
	async setAttend(schedule: ISchedule, date?: number) {
		const data = await this.getAccount();
		const amount = await this.getAmount(data);
		if (isUndefined(schedule.price))
			schedule.price = await this.getEventPrice(schedule[FIELD.key], data);

		const creates: TStoreBase[] = [];
		const updates: TStoreBase[] = [];
		const stamp = getStamp();
		const activePay = await this.getPayment(schedule.price, data);
		const payments = data.account.payment;

		if (payments[0]) {
			if (payments[0][FIELD.id] !== activePay[FIELD.id]) {
				if (amount.credit)
					activePay.bank = amount.credit;					// un-used creditit
				creates.push(Object.assign({ [FIELD.effect]: stamp }, activePay));
				updates.push(Object.assign(payments[0], { [FIELD.expire]: stamp }));
			} else {
				if (!activePay[FIELD.effect])
					updates.push(Object.assign(activePay, { [FIELD.effect]: stamp }));
			}
		}

		const attendDoc = {
			[FIELD.store]: STORE.attend,
			[FIELD.type]: schedule[FIELD.key] as TClass,	// the Attend's class
			[FIELD.uid]: data.auth.user!.uid,
			schedule: schedule[FIELD.id],									// <id> of the Schedule
			payment: activePay[FIELD.id],									// <id> of Account's current active document
			amount: schedule.price,
			stamp: stamp,
			date: fmtDate<number>(DATE_KEY.yearMonthDay, date)
		} as IAttend
		creates.push(attendDoc as TStoreBase);

		// this.dbg('creates: %j', creates);
		// this.dbg('updates: %j', updates);
		return this.data.batch(creates, updates);
	}

	/** Current Account status */
	async getAccount(uid?: string) {
		return this.state.getAccountData(uid)
			.pipe(take(1))
			.toPromise()
	}

	async getAmount(data?: IAccountState) {
		data = data || await this.getAccount();
		const { bank, pend, paid, spend } = data.account.summary;
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
	getAuthProfile() {
		const auth = this.store.selectSnapshot<IAuthState>(AuthState.auth);
		if (isNull(auth.info) || isUndefined(auth.info))
			return;													// No AdditionalUserInfo available

		const memberInfo = getMemberInfo(auth.info);
		const profileInfo: Partial<IProfileInfo> = {
			...memberInfo,									// spread the conformed member info
			[FIELD.effect]: getStamp(),			// TODO: remove this when API supports local getMeta()
			[FIELD.store]: STORE.profile,
			[FIELD.type]: 'info',
		}

		const where: TWhere = { fieldPath: 'providerId', value: auth.info.providerId };
		this.data.insDoc(profileInfo as IProfileInfo, where, Object.keys(memberInfo));
	}

}
