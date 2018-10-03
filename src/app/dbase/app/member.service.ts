import { Injectable } from '@angular/core';
import { timer } from 'rxjs';
import { debounce } from 'rxjs/operators';

import { Store, Actions, ofAction } from '@ngxs/store';
import { Navigate } from '@ngxs/router-plugin';
import { IUserInfo } from '@dbase/auth/auth.interface';
import { IAuthState, LoginInfo } from '@dbase/state/auth.define';
import { AuthState } from '@dbase/state/auth.state';

import { asAt } from '@dbase/app/app.library';
import { TWhere } from '@dbase/fire/fire.interface';
import { FIELD, STORE } from '@dbase/data/data.define';
import { DataService } from '@dbase/data/data.service';
import { IProfilePlan, TPlan, IClass, IAccount, IStoreBase, IAttend, IPrice, IStoreMeta, IProfileInfo } from '@dbase/data/data.schema';
import { DBaseModule } from '@dbase/dbase.module';

import { ROUTE } from '@route/route.define';
import { getStamp } from '@lib/date.library';
import { isUndefined, isNull } from '@lib/type.library';
import { asArray } from '@lib/array.library';
import { cloneObj } from '@lib/object.library';
import { dbg } from '@lib/logger.library';

@Injectable({ providedIn: DBaseModule })
export class MemberService {
	private dbg: Function = dbg.bind(this);
	private default: Promise<IStoreBase[]>;

	constructor(private readonly data: DataService, private readonly store: Store, private action: Actions) {
		this.dbg('new');
		this.default = this.data.snap<IStoreBase>(STORE.default)
			.then(table => asAt(table));								// stash the current defaults
		
		this.action.pipe(															// special: listen for changes of the auth.info
			ofAction(LoginInfo),												// when LoginInfo is fired by AuthState (on user-login)
			debounce(_ => timer(2000)),									// wait a couple of seconds to have State settle
		).subscribe(_ => this.getAuthProfile());			// check to see if auth.info has changed
	}

	async setPlan(plan: TPlan) {
		const doc: IStoreBase = { [FIELD.store]: STORE.profile, [FIELD.type]: 'plan', plan } as IProfilePlan;

		this.dbg('plan: %j', doc);
		return this.data.insDoc(doc, undefined, 'plan')
			.then(_ => this.store.dispatch(new Navigate([ROUTE.attend])))
			.catch(err => this.dbg('setPlan: %j', err.message))
	}

	/** Insert a new TopUp payment (do not set _effect/_expire) */
	async setPayment(amount?: number, memberId?: string) {
		const price = this.getPrice('topUp', memberId);
		amount = !isUndefined(amount) ? amount : (await price).amount;

		const accountDoc: IAccount = {
			[FIELD.store]: STORE.account,
			[FIELD.type]: 'topUp',
			amount: amount,
			active: false,
			stamp: getStamp(),
		}

		this.dbg('account: %j', accountDoc);
		return this.data.setDoc(STORE.account, accountDoc as IStoreMeta);
	}

	/** Insert an Attendance record, aligned to an <active> Account payment */
	async setAttend(event: IClass, price: number = 0, memberId?: string, date?: number) {
		const credit = await this.getCredit(memberId);
		let activeId = credit.active[0][FIELD.id];

		if (!activeId) {
			activeId = await this.setPayment(undefined, memberId);
		}

		this.dbg('event: %j', event);
		const attendDoc: IAttend = {
			[FIELD.store]: activeId || '<garbage>',							// <id> of Account's active document
			[FIELD.type]: event[FIELD.key],											// the Attend's event/class
			cost: price,
			stamp: getStamp(),
		}

		this.dbg('attend: %j', attendDoc);
		return this.data.setDoc(STORE.attend, attendDoc);
	}

	private getUserID(memberId?: string) {									// get the current User's uid
		return memberId || this.data.snap<IUserInfo>('userInfo')
			.then(info => asArray(info)[0])
			.then(info => info.uid);
	}

	async getCredit(memberId?: string) {
		const where: TWhere = [
			{ fieldPath: FIELD.type, value: 'topUp' },					// TODO: do we need to qualify just 'topUp' account payments?
			{ fieldPath: FIELD.key, value: await this.getUserID(memberId) },
		]

		const accountDocs = await this.data.snap<IAccount>(STORE.account)
			.then(table => asAt(table, where));									// get the User's current Account Docs

		const summary = accountDocs.reduce((sum, account) => {
			if (account.approve) sum.pay += account.amount;
			if (account.active) sum.bank += account.bank || 0;
			if (!account.approve) sum.pend += account.amount;
			if (account.active) sum.active.push(account);
			return sum
		}, { pay: 0, bank: 0, pend: 0, cost: 0, active: <IAccount[]>[] })	// calculate the Account summary

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
			{ fieldPath: FIELD.key, value: await this.getUserID(memberId) },
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

		let authInfo = cloneObj(auth.info);
		if (authInfo.profile) {
			const profile: any = authInfo.profile;
			delete profile.link;						// special: FaceBook changes this field periodically

			if (profile.picture && profile.picture.data && profile.picture.data.url)	// special: FaceBook changes the url-segment periodically
				profile.picture.data.url = profile.picture.data.url.split('?')[0];
			if (profile.grantedScopes) {		// special: FaceBook returns different names periodically
				profile.granted_scopes = profile.grantedScopes;
				delete profile.grantedScopes;
			}

			authInfo.profile = profile;			// rebuild authInfo.profile
		}

		const where: TWhere = { fieldPath: 'providerId', value: authInfo.providerId };
		const profileUser: IProfileInfo = {
			...authInfo,										// spread the authInfo object
			[FIELD.effect]: getStamp(),			// TODO: remove this when API supports local getMeta()
			[FIELD.store]: STORE.profile,
			[FIELD.type]: 'info',
		}

		this.data.insDoc(profileUser, where, 'profile');
	}

}
