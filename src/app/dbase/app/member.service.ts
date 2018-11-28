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
import { IProfilePlan, TPlan, IPayment, IProfileInfo, ISchedule, IClass } from '@dbase/data/data.schema';
import { DBaseModule } from '@dbase/dbase.module';

import { getStamp } from '@lib/date.library';
import { isUndefined, isNull } from '@lib/type.library';
import { dbg } from '@lib/logger.library';
import { IAccountState } from '@dbase/state/state.define';

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

	/** Insert a new TopUp payment (do not set _effect/_expire) */
	async setPayment(amount?: number) {
		// amount = !isUndefined(amount) ? amount : (await this.getPrice('topUp')).amount;

		const paymentId = this.data.newId;									// allocate a new pushId
		const paymentDoc: Partial<IPayment> = {
			[FIELD.id]: paymentId,
			[FIELD.store]: STORE.payment,
			[FIELD.type]: 'topUp',
			amount: amount,
			stamp: getStamp(),
		}

		this.data.setDoc(STORE.payment, paymentDoc as IPayment);
		return paymentId;
	}

	/** get (or set a new) active Payment */
	async getPayment(time?: ISchedule) {
		const data = await this.getAccount();
		this.dbg('time: %j', time);

		const activeId = data.account.payment[0] && data.account.payment[0][FIELD.id];
		const { bank, pend, pay, cost } = data.account.summary;
		const credit = bank + pend + pay - cost;

		if (isUndefined(time))															// no item selected from schedule
			return activeId;																	// will return <undefined> if no open payments

		if (isUndefined(time.price)) {											// work out the price for this class
			const profile = await this.getPlan(data);					// the member's plan
			const span = await this.state.getSingle<IClass>(STORE.class, { fieldPath: FIELD.key, value: time[FIELD.key] });
			const match = data.member.price										// look in member's price plan for a match in 'span' and '
				.find(row => row[FIELD.type] === span[FIELD.type] && row[FIELD.key] === profile.plan);
			time.price = match ? match.amount : 0;
		}

		if (time.price > credit) {

		}
	}

	/** Insert an Attendance record, aligned to an <active> Account payment */
	// TODO: determine <date> as the last occurrence of the <time>'s class
	async setAttend(time: ISchedule, date?: number) {
		// this.dbg('active: %j', account.active);
		// const activeId = account.active[account.active.length - 1]
		// 	|| account.payment[0]
		// // || await this.getPayment(undefined, true);
		// this.dbg('activeId: %j', activeId);
		this.getPayment(time);
		return;

		// if (isUndefined(time.price))
		// 	time.price = (await this.getPrice('full')).amount;	// TODO: get the class span, to determine price

		// const attendDoc: Partial<IAttend> = {
		// 	[FIELD.store]: STORE.attend,
		// 	[FIELD.type]: time[FIELD.key],											// the Attend's class
		// 	schedule: time[FIELD.id],														// <id> of the Schedule
		// 	payment: activeId,																	// <id> of Account's current active document
		// 	amount: time.price,
		// 	stamp: getStamp(),
		// 	date: fmtDate<number>(DATE_KEY.yearMonthDay, date)
		// }

		// this.dbg('credit: %j', account);
		// this.dbg('time: %j', time);
		// this.dbg('attend: %j', attendDoc);
		// return this.data.setDoc(STORE.attend, attendDoc as IAttend);
	}

	/** Current Account status */
	async getAccount(uid?: string) {
		return this.state.getAccountData(uid)
			.pipe(take(1))
			.toPromise()
	}

	async getCredit(data: IAccountState) {
		data = data || (await this.getAccount());
		const { bank, pend, pay, cost } = data.account.summary;
		return bank + pend + pay - cost;
	}

	async	getPlan(data: IAccountState) {
		data = data || (await this.getAccount());
		return data.member.plan[0];
	}

	async getPrice(event: string, data: IAccountState) {
		data = data || (await this.getAccount());
		const profile = data.member.plan[0];						// the member's plan
		const span = await this.state.getSingle<IClass>(STORE.class, { fieldPath: FIELD.key, value: event });

		return data.member.price												// look in member's prices for a match in 'span' and 'plan'
			.filter(row => row[FIELD.type] === span[FIELD.type] && row[FIELD.key] === profile.plan)[0].amount || 0;
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
