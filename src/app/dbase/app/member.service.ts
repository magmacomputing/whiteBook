import { Injectable } from '@angular/core';
import { Store } from '@ngxs/store';
import { Navigate } from '@ngxs/router-plugin';

import { DataService } from '@dbase/data/data.service';
import { IProfilePlan, TPlan, IClass, IAccount } from '@dbase/data/data.interface';
import { FIELD, STORE, COLLECTION } from '@dbase/data/data.define';

import { ROUTE } from '@route/route.define';
import { dbg } from '@lib/logger.library';
import { getStamp } from '@lib/date.library';
import { isEmpty } from '@lib/object.library';

@Injectable({ providedIn: 'root' })
export class MemberService {
	private dbg: Function = dbg.bind(this);

	constructor(private readonly data: DataService, private readonly store: Store) { this.dbg('new') }

	setPlan(plan: TPlan, amount: number, exist: boolean) {
		if (!exist)
			this.setPayment(amount);								// first Payment due

		const planDoc: IProfilePlan = {
			[FIELD.id]: '',													// placeholder
			[FIELD.key]: '',                        // placeholder
			[FIELD.store]: STORE.profile,
			[FIELD.type]: 'plan',
			plan: plan,
		}

		this.dbg('plan: %j', planDoc);
		this.data.insDoc(COLLECTION.Member, planDoc)
			.then(_ => this.store.dispatch(new Navigate([ROUTE.attend])))
			.catch(err => this.dbg('setPlan: %j', err))
	}

	setPayment(amount: number) {
		const accountDoc: IAccount = {
			[FIELD.id]: '',												// placeholder
			[FIELD.key]: '',											// placeholder
			[FIELD.store]: STORE.account,
			[FIELD.type]: 'topUp',
			amount: amount,
			date: getStamp(),
			active: true,
		}
		this.dbg('account: %j', accountDoc);
		this.data.insDoc(COLLECTION.Member, accountDoc);
	}

	checkIn(event: IClass, date?: number) {
		const attendDoc = {
			[FIELD.id]: this.data.newId,
			store: 'abc',
		}

		this.dbg('attend: %j', attendDoc);
		this.data.setDoc(COLLECTION.Attend, attendDoc)
			.then(_ => this.store.dispatch(new Navigate([ROUTE.status])))
			.catch(err => this.dbg('checkIn: %j', err))
	}
}
