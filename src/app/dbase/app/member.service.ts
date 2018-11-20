import { Injectable } from '@angular/core';

import { timer } from 'rxjs';
import { debounce, take } from 'rxjs/operators';
import { Store, Actions, ofAction } from '@ngxs/store';

import { StateService } from '@dbase/state/state.service';
import { IUserInfo } from '@dbase/auth/auth.interface';
import { IAuthState, LoginInfo } from '@dbase/state/auth.define';
import { AuthState } from '@dbase/state/auth.state';

import { asAt } from '@dbase/app/app.library';
import { TWhere } from '@dbase/fire/fire.interface';
import { getMemberInfo } from '@dbase/app/member.library';
import { FIELD, STORE } from '@dbase/data/data.define';
import { DataService } from '@dbase/data/data.service';
import { IProfilePlan, TPlan, IPayment, IAttend, IPrice, IProfileInfo, IDefault, ISchedule } from '@dbase/data/data.schema';
import { DBaseModule } from '@dbase/dbase.module';

import { getStamp } from '@lib/date.library';
import { isUndefined, isNull } from '@lib/type.library';
import { asArray } from '@lib/array.library';
import { dbg } from '@lib/logger.library';

@Injectable({ providedIn: DBaseModule })
export class MemberService {
	private dbg: Function = dbg.bind(this);
	private default: Promise<IDefault[]>;

	constructor(private readonly data: DataService, private readonly store: Store, private state: StateService, private action: Actions) {
		this.dbg('new');
		this.default = this.data.snap<IDefault>(STORE.default)
			.then(table => asAt(table));								// stash the current defaults

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
	async setPayment(amount?: number, active?: boolean) {
		const price = this.getPrice('topUp');
		const paymentId = this.data.newId;

		amount = !isUndefined(amount) ? amount : (await price).amount;

		const accountDoc: Partial<IPayment> = {
			[FIELD.id]: paymentId,
			[FIELD.store]: STORE.payment,
			[FIELD.type]: 'topUp',
			amount: amount,
			active: active,
			stamp: getStamp(),
		}

		this.dbg('account: %j', accountDoc);
		this.data.setDoc(STORE.payment, accountDoc as IPayment);
		return paymentId;
	}

	/** Insert an Attendance record, aligned to an <active> Account payment */
	async setAttend(time: ISchedule, date?: number) {
		const account = await this.getCredit();
		const activeId = account.active[0] || await this.setPayment(undefined, true);

		if (isUndefined(time.price))
			time.price = (await this.getPrice('full')).amount;	// TODO: get the class span, to determine price

		const attendDoc: Partial<IAttend> = {
			[FIELD.store]: STORE.attend,
			[FIELD.type]: time[FIELD.key],											// the Attend's class
			schedule: time[FIELD.id],														// <id> of the Schedule
			payment: activeId,																	// <id> of Account's current active document
			amount: time.price,
			stamp: getStamp(),
			date: getStamp(),
		}

		this.dbg('credit: %j', account);
		this.dbg('time: %j', time);
		this.dbg('attend: %j', attendDoc);
		return this.data.setDoc(STORE.attend, attendDoc as IAttend);
	}

	/** Current Account status */
	getAccount() {
		return this.state.getAccountData()
			.pipe(take(1))
			.toPromise()
	}

	getCredit() {
		return this.getAccount()
			.then(summary => summary.account)
	}

	getPrice(type: string) {																	// type: 'full' | 'half' | 'topUp'
		return this.getAccount()
			.then(summary => summary.member.price)
			.then(prices => prices.filter(row => row[FIELD.type] === type)[0])
	}

	getPlan() {
		return this.getAccount()
			.then(summary => summary.member.plan[0])
	}

	/** Build a default document for a named <type> */
	getDefault(type: string) {
		return this.default
			.then(table => table.filter(row => row.type === type))
			.then(table => table[0])
			.then(doc => ({ ...doc, ...{ [type]: doc[FIELD.key] } }))
	}

	/** check for change of User.additionalInfo */
	getAuthProfile() {
		const auth = this.store.selectSnapshot<IAuthState>(AuthState.auth);
		if (isNull(auth.info) || isUndefined(auth.info))
			return;													// No AdditionalUserInfo available

		const memberInfo = getMemberInfo(auth.info);
		if (memberInfo.photoURL)					// strip the queryParams
			memberInfo.photoURL = memberInfo.photoURL.split('?')[0];

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
