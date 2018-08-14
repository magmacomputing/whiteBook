import { Injectable } from '@angular/core';

import { Store } from '@ngxs/store';
import { Navigate } from '@ngxs/router-plugin';
import { IUserInfo } from '@dbase/auth/auth.interface';

import { IWhere } from '@dbase/fire/fire.interface';
import { DataService } from '@dbase/data/data.service';
import { IProfilePlan, TPlan, IClass, IAccount, IStoreBase, IAttend, IPrice, IStoreMeta } from '@dbase/data/data.schema';
import { FIELD, STORE } from '@dbase/data/data.define';
import { asAt } from '@dbase/app/app.library';

import { ROUTE } from '@route/route.define';
import { getStamp } from '@lib/date.library';
import { isUndefined, asArray } from '@lib/object.library';
import { dbg } from '@lib/logger.library';

@Injectable({ providedIn: 'root' })
export class MemberService {
	private dbg: Function = dbg.bind(this);
	private default: Promise<IStoreBase[]>;

	constructor(private readonly data: DataService, private readonly store: Store) {
		this.dbg('new');
		this.default = this.data.snap<IStoreBase>(STORE.default)
			.then(table => asAt(table));																			// stash the current defaults
	}

	async setPlan(plan: TPlan, amount: number) {
		const doc: IStoreBase = { [FIELD.store]: STORE.profile, [FIELD.type]: 'plan', plan } as IProfilePlan;

		this.dbg('plan: %j', doc);
		this.data.insDoc(doc)
			.then(_ => this.store.dispatch(new Navigate([ROUTE.attend])))
			.catch(err => this.dbg('setPlan: %j', err.message))
	}

	/** Insert a new TopUp payment (do not set _effect/_expire) */
	async setPayment(amount?: number, memberId?: string) {
		const [uid, price] = await Promise.all([
			this.getUserID(memberId),
			this.getPrice('topUp', memberId)
		])

		const accountDoc: IAccount = {
			[FIELD.store]: STORE.account,
			[FIELD.type]: 'topUp',
			amount: !isUndefined(amount) ? amount : price.amount,
			active: false,
			stamp: getStamp(),
		}

		this.dbg('account: %j', accountDoc);
		return this.data.setDoc(STORE.account, accountDoc as IStoreMeta);
	}

	/** Insert an Attendance record, aligned to an <active> Account payment */
	async setAttend(event: IClass, price?: number, memberId?: string, date?: number) {
		const credit = await this.getCredit(memberId);
		const activeId = credit.active[0][FIELD.id];

		// if (!activeId)
		// 	 ;											// TODO: mark a row as <active>

		// TODO: get cost of event (normal, bonus, gift)

		this.dbg('event: %j', event);
		const attendDoc: IAttend = {
			[FIELD.store]: activeId || '<garbage>',
			stamp: getStamp(),
			class: event[FIELD.key],
			cost: 0,
		}

		this.dbg('attend: %j', attendDoc);
		return this.data.setDoc(STORE.attend, attendDoc as IStoreMeta);
	}

	private getUserID(memberId?: string) {										// get the current User's uid
		return memberId || this.data.snap<IUserInfo>('userInfo')
			.then(info => asArray(info)[0])
			.then(info => info.uid);
	}

	async getCredit(memberId?: string) {
		const where: IWhere[] = [
			{ fieldPath: FIELD.type, value: 'topUp' },						// TODO: do we need to qualify just 'topUp' account payments?
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
		}, { pay: 0, bank: 0, pend: 0, cost: 0, active: <IAccount[]>[] })											// calculate the Account summary

		const activeAccount = accountDocs.filter(account => account.active)[0] || {};
		const activeId = activeAccount[FIELD.id] || '';

		const attendDocs = await this.data.snap<IAttend>(activeId) || [];
		attendDocs.reduce((summary, attend) => {			// get the Attend docs related to the active Account doc
			summary.cost += attend.cost																	// add up each Attend's cost
			return summary;
		}, summary)

		this.dbg('summary: %j', summary);
		return summary;
	}

	async getPrice(type: string, memberId?: string) {				// type: 'full' | 'half' | 'topUp'
		const planDoc = await this.getPlan(memberId);
		const where: IWhere[] = [
			{ fieldPath: FIELD.type, value: type },
			{ fieldPath: FIELD.key, value: planDoc.plan },
		];

		const priceDoc = await this.data.snap<IPrice>(STORE.price)
			.then(table => asAt(table, where)[0] || {})
		this.dbg('price: %j', priceDoc);

		return priceDoc;
	}

	async getPlan(memberId?: string) {											// find out the User's current <plan>
		const where: IWhere[] = [
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
			.then(doc => { return { ...doc, ...{ [type]: doc[FIELD.key] } } })
	}
}
