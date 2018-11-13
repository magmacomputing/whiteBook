import { Injectable } from '@angular/core';
import { Router } from '@angular/router';

import { timer } from 'rxjs';
import { debounce } from 'rxjs/operators';
import { Store, Actions, ofAction } from '@ngxs/store';

import { IUserInfo } from '@dbase/auth/auth.interface';
import { IAuthState, LoginInfo } from '@dbase/state/auth.define';
import { AuthState } from '@dbase/state/auth.state';

import { asAt } from '@dbase/app/app.library';
import { TWhere } from '@dbase/fire/fire.interface';
import { getMemberInfo } from '@dbase/app/member.library';
import { FIELD, STORE } from '@dbase/data/data.define';
import { DataService } from '@dbase/data/data.service';
import { IProfilePlan, TPlan, IClass, IPayment, IAttend, IPrice, IProfileInfo, IDefault } from '@dbase/data/data.schema';
import { DBaseModule } from '@dbase/dbase.module';

import { ROUTE } from '@route/route.define';
import { getStamp } from '@lib/date.library';
import { isUndefined, isNull } from '@lib/type.library';
import { asArray } from '@lib/array.library';
import { dbg } from '@lib/logger.library';

@Injectable({ providedIn: DBaseModule })
export class MemberService {
	private dbg: Function = dbg.bind(this);
	private default: Promise<IDefault[]>;

	constructor(private readonly data: DataService, private readonly store: Store, private action: Actions, private router: Router) {
		this.dbg('new');
		this.default = this.data.snap<IDefault>(STORE.default)
			.then(table => asAt(table));								// stash the current defaults

		this.action.pipe(															// special: listen for changes of the auth.info
			ofAction(LoginInfo),												// when LoginInfo is fired by AuthState (on user-login)
			debounce(_ => timer(2000)),									// wait a couple of seconds to have State settle
		).subscribe(_ => this.getAuthProfile());			// check to see if auth.info has changed
		this.store.dispatch(new LoginInfo());					// and fire an initial LoginInfo check
	}

	async setPlan(plan: TPlan) {
		const doc = { [FIELD.store]: STORE.profile, [FIELD.type]: 'plan', plan } as IProfilePlan;

		this.dbg('plan: %j', doc);
		return this.data.insDoc(doc, undefined, 'plan')
			.then(_ => this.router.navigateByUrl(ROUTE.attend))
			.catch(err => this.dbg('setPlan: %j', err.message))
	}

	/** Insert a new TopUp payment (do not set _effect/_expire) */
	async setPayment(amount?: number, memberId?: string) {
		const price = this.getPrice('topUp', memberId);
		amount = !isUndefined(amount) ? amount : (await price).amount;

		const accountDoc: Partial<IPayment> = {
			[FIELD.store]: STORE.payment,
			[FIELD.type]: 'topUp',
			amount: amount,
			active: false,
			stamp: getStamp(),
		}

		this.dbg('account: %j', accountDoc);
		return this.data.setDoc(STORE.payment, accountDoc as IPayment);
	}

	/** Insert an Attendance record, aligned to an <active> Account payment */
	async setAttend(event: IClass, price: number = 0, memberId?: string, date?: number) {
		const credit = await this.getCredit();
		let activeId = credit.active[0][FIELD.id];

		if (!activeId) {
			activeId = await this.setPayment(undefined, memberId);
		}

		this.dbg('event: %j', event);
		const attendDoc: Partial<IAttend> = {
			[FIELD.store]: STORE.attend,												// <id> of Account's active document
			[FIELD.type]: event[FIELD.key],											// the Attend's event/class
			payment: activeId,
			schedule: '',
			cost: price,
			stamp: getStamp(),
		}

		this.dbg('attend: %j', attendDoc);
		return this.data.setDoc(STORE.attend, attendDoc as IAttend);
	}

	private getUserID(memberId?: string) {									// get the current User's uid
		return memberId || this.data.snap<IUserInfo>('userInfo')
			.then(info => asArray(info)[0])
			.then(info => info.uid);
	}

	async getCredit(accountDocs: IPayment[] = []) {
		const summary = accountDocs.reduce((sum, account) => {
			if (account.approve) sum.pay += account.amount;
			if (account.active) sum.bank += account.bank || 0;
			if (!account.approve) sum.pend += account.amount;
			if (account.active) sum.active.push(account);
			return sum
		}, { pay: 0, bank: 0, pend: 0, cost: 0, active: <IPayment[]>[] })	// calculate the Account summary

		const activeAccount = accountDocs.filter(account => account.active)[0] || {};
		const activeId = activeAccount[FIELD.id] || '';

		const attendDocs = await this.data.snap<IAttend>(activeId) || [];
		attendDocs.reduce((summary, attend) => {							// get the Attend docs related to the active Account doc
			summary.cost += attend.cost													// add up each Attend's cost
			return summary;
		}, summary)

		this.dbg('summary: %j', summary);
		return summary;
	}

	async getPrice(type: string, memberId?: string) {				// type: 'full' | 'half' | 'topUp'
		const planDoc = await this.getPlan(memberId);
		const where: TWhere = [
			{ fieldPath: FIELD.type, value: type },
			{ fieldPath: FIELD.key, value: planDoc.plan },
		];

		const priceDoc = await this.data.snap<IPrice>(STORE.price)
			.then(table => asAt(table, where)[0] || {})
		this.dbg('price: %j', priceDoc);

		return priceDoc;
	}

	async getPlan(memberId?: string) {											// find out the User's current <plan>
		const where: TWhere = [
			{ fieldPath: FIELD.type, value: 'plan' },
			{ fieldPath: FIELD.uid, value: await this.getUserID(memberId) },
		];

		const defaultDoc = await this.getDefault(STORE.plan);
		const planDoc = await this.data.snap<IProfilePlan>(STORE.profile)
			.then(table => asAt(table, where)[0]);
		this.dbg('plan: %j', planDoc);

		return planDoc || defaultDoc;
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

		const where: TWhere = { fieldPath: 'providerId', value: auth.info.providerId };
		const memberInfo = getMemberInfo(auth.info);
		const profileInfo: Partial<IProfileInfo> = {
			...memberInfo,									// spread the conformed member info
			[FIELD.effect]: getStamp(),			// TODO: remove this when API supports local getMeta()
			[FIELD.store]: STORE.profile,
			[FIELD.type]: 'info',
		}

		this.data.insDoc(profileInfo as IProfileInfo, where, Object.keys(memberInfo));
	}

}
