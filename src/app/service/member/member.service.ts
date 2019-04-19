import { Injectable } from '@angular/core';
import { Store } from '@ngxs/store';

import { DBaseModule } from '@dbase/dbase.module';
import { getMemberInfo, calcExpiry } from '@service/member/member.library';
import { SnackService } from '@service/snack/snack.service';
import { StateService } from '@dbase/state/state.service';
import { DataService } from '@dbase/data/data.service';
import { SyncService } from '@dbase/sync/sync.service';

import { MemberInfo } from '@dbase/state/auth.action';
import { TWhere } from '@dbase/fire/fire.interface';
import { addWhere } from '@dbase/fire/fire.library';
import { FIELD, STORE, COLLECTION, MEMBER } from '@dbase/data/data.define';
import { IProfilePlan, TPlan, IPayment, IProfileInfo, IClass, IBonus, IAttend, IGift } from '@dbase/data/data.schema';

import { getStamp, TDate, getDate, DATE_FMT } from '@lib/date.library';
import { isUndefined, isNull } from '@lib/type.library';
import { dbg } from '@lib/logger.library';
import { take } from 'rxjs/operators';
import { IAccountState } from '@dbase/state/state.define';

@Injectable({ providedIn: DBaseModule })
export class MemberService {
	private dbg = dbg(this);

	constructor(private readonly data: DataService, private readonly store: Store,
		private state: StateService, private snack: SnackService, private sync: SyncService) {
		this.dbg('new');

		this.sync.wait(MemberInfo, _ => this.getAuthProfile());
		this.store.dispatch(new MemberInfo());				// now fire the initial MemberInfo check
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
	async setPayment(amount?: number) {
		const data = await this.getAccount();
		const topUp = await this.getPayPrice(data);			// find the topUp price for this Member

		return {
			[FIELD.id]: this.data.newId,									// in case we need to update a Payment within a Batch
			[FIELD.store]: STORE.payment,
			[FIELD.type]: 'topUp',
			amount: isUndefined(amount) ? topUp : amount,
			stamp: getStamp(),
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

	getPlan = async (data?: IAccountState) => {
		data = data || await this.getAccount();
		return data.member.plan[0];
	}

	// TODO: apply bonus-tracking to determine discount price
	getEventPrice = async (event: string, data?: IAccountState) => {
		data = data || (await this.getAccount());
		const profile = data.member.plan[0];						// the member's plan
		const span = await this.state.getSingle<IClass>(STORE.class, addWhere(FIELD.key, event));

		return data.client.price												// look in member's prices for a match in 'span' and 'plan'
			.filter(row => row[FIELD.type] === span[FIELD.type] && row[FIELD.key] === profile.plan)[0].amount || 0;
	}

	/** Determine the member's topUp amount */
	getPayPrice = async (data?: IAccountState) => {
		data = data || await this.getAccount();

		return data.client.price
			.filter(row => row[FIELD.type] === 'topUp')[0].amount || 0;
	}

	/** check for change of User.additionalInfo */
	async getAuthProfile() {
		const user = await this.state.asPromise(this.state.getAuthData());
		if (isNull(user.auth.info) || isUndefined(user.auth.info))
			return;																				// No AdditionalUserInfo available

		const memberInfo = getMemberInfo(user.auth.info);
		const profileInfo: Partial<IProfileInfo> = {
			...memberInfo,																// spread the conformed member info
			[FIELD.effect]: getStamp(),										// TODO: remove this when API supports local getMeta()
			[FIELD.store]: STORE.profile,
			[FIELD.type]: 'info',
			[FIELD.uid]: user.auth.user!.uid,
		}

		const where = addWhere('providerId', user.auth.info.providerId);
		this.data.insDoc(profileInfo as IProfileInfo, where, Object.keys(memberInfo));
	}

}
