import { Injectable } from '@angular/core';
import { take, first } from 'rxjs/operators';

import { DBaseModule } from '@dbase/dbase.module';
import { getMemberInfo } from '@service/member/member.library';
import { SnackService } from '@service/material/snack.service';
import { StateService } from '@dbase/state/state.service';
import { DataService } from '@dbase/data/data.service';

import { addWhere } from '@dbase/fire/fire.library';
import { AuthState } from '@dbase/state/auth.state';
import { FIELD, STORE } from '@dbase/data/data.define';
import { IProfilePlan, TPlan, IPayment, IProfileInfo, IClass, IStoreMeta, IStatusAccount } from '@dbase/data/data.schema';

import { getStamp, TDate } from '@lib/date.library';
import { isUndefined, isNull } from '@lib/type.library';
import { IAccountState } from '@dbase/state/state.define';
import { dbg } from '@lib/logger.library';

@Injectable({ providedIn: DBaseModule })
export class MemberService {
	private dbg = dbg(this);

	constructor(private readonly data: DataService, private readonly auth: AuthState, private state: StateService, private snack: SnackService) {
		this.dbg('new');
		this.listenInfo(true);
	}

	public async listenInfo(init: boolean = false) {
		if (init) {
			const user = await this.auth.auth;
			if (!user) return;														// dont listen if not logged-in on constructor()
		}

		this.dbg('listen');
		this.auth.memberSubject													// this.auth will call complete() on first emit
			.pipe(first(info => !isNull(info)))						// subscribe until the first non-null response
			.subscribe(info => this.getAuthProfile(info))
			.unsubscribe()																// not really needed
	}

	async setPlan(plan: TPlan, dt?: TDate) {
		const doc = {
			[FIELD.effect]: getStamp(dt),
			[FIELD.store]: STORE.profile,
			[FIELD.type]: 'plan',
			plan
		} as IProfilePlan;
		this.dbg('plan: %j', doc);

		return this.data.insDoc(doc, undefined, 'plan')
			.catch(err => this.dbg('setPlan: %j', err.message))
	}

	/** Create a new TopUp payment */
	async setPayment(amount?: number, stamp?: TDate) {
		const data = await this.getAccount();
		const topUp = await this.getPayPrice(data);			// find the topUp price for this Member

		return {
			[FIELD.id]: this.data.newId,									// in case we need to update a Payment within a Batch
			[FIELD.store]: STORE.payment,
			[FIELD.type]: 'topUp',
			amount: isUndefined(amount) ? topUp : amount,
			stamp: getStamp(stamp),
		} as IPayment
	}

	/** Current Account status */
	getAccount = async (date?: TDate) => {
		return this.state.getAccountData(date)
			.pipe(take(1))
			.toPromise()
	}

	getAmount = async (data?: IAccountState) => {
		data = data || await this.getAccount();
		return data.account.summary;
	}

	setAccount = async (creates: IStoreMeta[] = [], updates: IStoreMeta[] = [], data?: IAccountState) => {
		data = data || await this.getAccount();
		const uid = await this.data.getUID();
		const [summary, doc] = await Promise.all([
			this.getAmount(data),
			this.data.getStore<IStatusAccount>(STORE.status, [addWhere(FIELD.uid, uid), addWhere(FIELD.type, 'account')]),
		]);
		const accountDoc: Partial<IStatusAccount> = !doc.length
			? {																// scaffold a new Account doc
				[FIELD.store]: STORE.status,
				[FIELD.type]: 'account',
				[FIELD.uid]: uid,
				stamp: getStamp(),
				summary,
			}
			: { ...doc[0], stamp: getStamp(), summary }

		if (!accountDoc[FIELD.id])
			creates.push(accountDoc as IStoreMeta)
		else updates.push(accountDoc as IStoreMeta)
		return accountDoc;
	}

	updAccount = async (data?: IAccountState) => {
		const creates: IStoreMeta[] = [];
		const updates: IStoreMeta[] = [];
		await this.setAccount(creates, updates, data);
		return this.data.batch(creates, updates);
	}

	getPlan = async (data?: IAccountState) => {
		data = data || await this.getAccount();
		return data.member.plan[0];
	}

	// TODO: apply bonus-tracking to determine discount price
	getEventPrice = async (event: string, data?: IAccountState) => {
		data = data || (await this.getAccount());
		const profile = data.member.plan[0];						// the member's plan
		const span = await this.state.getSingle<IClass>(STORE.class, addWhere(FIELD.key, event));

		return data.client.price												// look in member's prices as a match in 'span' and 'plan'
			.filter(row => row[FIELD.type] === span[FIELD.type] && row[FIELD.key] === profile.plan)[0].amount || 0;
	}

	/** Determine the member's topUp amount */
	getPayPrice = async (data?: IAccountState) => {
		data = data || await this.getAccount();

		return data.client.price
			.filter(row => row[FIELD.type] === 'topUp')[0].amount || 0;
	}

	/** check for change of User.additionalInfo */
	async getAuthProfile(info: firebase.auth.AdditionalUserInfo | null, uid?: string) {
		if (isNull(info) || isUndefined(info))
			return;																				// No AdditionalUserInfo available
		this.dbg('info: %s', info.providerId);

		const user = this.state.asPromise(this.state.getAuthData());
		const memberInfo = getMemberInfo(info);
		const profileInfo: Partial<IProfileInfo> = {
			[FIELD.effect]: getStamp(),										// TODO: remove this when API supports local getMeta()
			[FIELD.store]: STORE.profile,
			[FIELD.type]: 'info',
			[FIELD.uid]: uid || (await user).auth.user!.uid,
			info: { ...memberInfo },											// spread the conformed member info
		}

		const where = addWhere('info.providerId', info.providerId);
		this.data.insDoc(profileInfo as IProfileInfo, where, 'info');
	}

}
