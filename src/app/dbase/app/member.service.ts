import { Injectable } from '@angular/core';
import { Store } from '@ngxs/store';
import { Navigate } from '@ngxs/router-plugin';

import { DataService } from '@dbase/data/data.service';
import { IProfilePlan, TPlan, IClass, IAccount, IStoreBase, IAttend } from '@dbase/data/data.schema';
import { FIELD, STORE } from '@dbase/data/data.define';

import { ROUTE } from '@route/route.define';
import { getStamp } from '@lib/date.library';
import { isEmpty } from '@lib/object.library';
import { dbg } from '@lib/logger.library';

@Injectable({ providedIn: 'root' })
export class MemberService {
	private dbg: Function = dbg.bind(this);

	constructor(private readonly data: DataService, private readonly store: Store) { this.dbg('new') }

	async setPlan(plan: TPlan, amount: number) {
		const doc: IStoreBase[] = [{ [FIELD.store]: STORE.profile, [FIELD.type]: 'plan', plan } as IProfilePlan];
		const account = await this.data.snap(STORE.account)

		if (isEmpty(account))											// need to create initial Account document
			doc.push({ [FIELD.store]: STORE.account, [FIELD.type]: 'topUp', amount, active: true, stamp: getStamp() } as IAccount)

		this.dbg('plan: %j', doc);
		this.data.insDoc(doc)
			.then(_ => this.store.dispatch(new Navigate([ROUTE.attend])))
			.catch(err => this.dbg('setPlan: %j', err.message))
	}

	setPayment(amount: number) {
		const accountDoc: IAccount = {
			[FIELD.store]: STORE.account,
			[FIELD.type]: 'topUp',
			amount: amount,
			active: false,
			stamp: getStamp(),
		}
		this.dbg('account: %j', accountDoc);
		return this.data.insDoc(accountDoc);
	}

	checkIn(event: IClass, date?: number) {
		const attendDoc: IAttend = {
			[FIELD.store]: 'attend',
		}

		this.dbg('attend: %j', attendDoc);

		// this.data.setDoc(COLLECTION.Attend, attendDoc)
		// 	.then(_ => this.store.dispatch(new Navigate([ROUTE.status])))
		// 	.catch(err => this.dbg('checkIn: %j', err))
	}
}
