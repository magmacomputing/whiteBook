import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { Store, Select } from '@ngxs/store';
import { Navigate } from '@ngxs/router-plugin';
import { AuthState } from '@dbase/state/auth.state';
import { IAuthState } from '@dbase/state/auth.define';
import { IStoreState } from '@dbase/state/store.define';
import { MemberState } from '@dbase/state/member.state';
import { AttendState } from '@dbase/state/attend.state';

import { IWhere } from '@dbase/fire/fire.interface';
import { DataService } from '@dbase/data/data.service';
import { IProfilePlan, TPlan, IClass, IAccount, IStoreBase, IAttend } from '@dbase/data/data.schema';
import { FIELD, STORE } from '@dbase/data/data.define';
import { asAt } from '@dbase/app/app.library';

import { ROUTE } from '@route/route.define';
import { getStamp } from '@lib/date.library';
import { isUndefined, isArray } from '@lib/object.library';
import { dbg } from '@lib/logger.library';


@Injectable({ providedIn: 'root' })
export class MemberService {
	private dbg: Function = dbg.bind(this);
	@Select(AuthState.getUser) auth$!: Observable<IAuthState>;

	constructor(private readonly data: DataService, private readonly store: Store) { this.dbg('new') }

	async setPlan(plan: TPlan, amount: number) {
		const doc: IStoreBase[] = [{ [FIELD.store]: STORE.profile, [FIELD.type]: 'plan', plan } as IProfilePlan];
		const account = await this.data.snap(STORE.account)

		if (isUndefined(account) || (isArray(account) && account.length === 0)) // need to create initial Account document
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

	setAttend(event: IClass, price?: number, date?: number) {
		const attendDoc: IAttend = {
			[FIELD.store]: 'attend',
			stamp: getStamp(),
			class: event[FIELD.key],
			cost: 0,
			account: '',
		}

		this.dbg('attend: %j', attendDoc);
	}

	async getCredit(memberId?: string) {
		const auth = this.auth$.toPromise();						// get the current User's uid
		const whereAccount: IWhere = { fieldPath: 'type', value: 'topUp' };
		const [memberState, attendState] = await Promise.all([
			this.store.selectOnce(MemberState).toPromise(),
			this.store.selectOnce(AttendState).toPromise(),
		])

		const accountDocs = asAt<IAccount>(memberState[STORE.account], whereAccount);
		const summary = accountDocs.reduce((sum, account) => {
			if (account.approve) sum.pay += account.amount;
			if (account.active) sum.bank += account.bank || 0;
			if (!account.approve) sum.pend += account.amount;
			return sum
		}, { pay: 0, bank: 0, pend: 0 })

		const activeAccount = accountDocs.filter(account => account.active)[0] || {};
		const activeId = activeAccount[FIELD.id] || '';

		const attendDocs: IAttend[] = attendState[activeId] || [];
		const attend = attendDocs.reduce((sum, attend) => {
			sum += attend.cost;
			return sum;
		}, 0)

		this.dbg('summary: %j', summary);
		this.dbg('attend: %j', attend);
	}
}
