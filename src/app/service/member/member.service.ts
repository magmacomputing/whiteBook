import { Injectable } from '@angular/core';
import { take, first, delay } from 'rxjs/operators';

import { DBaseModule } from '@dbase/dbase.module';
import { getMemberInfo } from '@service/member/member.library';
import { SnackService } from '@service/material/snack.service';
import { StateService } from '@dbase/state/state.service';
import { DataService } from '@dbase/data/data.service';

import { asAt } from '@library/app.library';
import { addWhere } from '@dbase/fire/fire.library';
import { AuthState } from '@dbase/state/auth.state';
import { FIELD, STORE, PLAN, PRICE, PROFILE, STATUS, PAYMENT } from '@dbase/data/data.define';
import { ProfilePlan, Payment, ProfileInfo, Class, StoreMeta, StatusAccount, Price } from '@dbase/data/data.schema';

import { getStamp, TInstant } from '@library/instant.library';
import { isNull } from '@library/type.library';
import { AccountState } from '@dbase/state/state.define';
import { dbg } from '@library/logger.library';

@Injectable({ providedIn: DBaseModule })
export class MemberService {
	private dbg = dbg(this);

	constructor(private readonly data: DataService, private auth: AuthState, private state: StateService, private snack: SnackService) {
		this.dbg('new');
		this.listenInfo(true);
	}

	public async listenInfo(init = false) {
		if (init) {
			if (!await this.data.auth.user)
				return;																			// dont listen from constructor if not signed-In
		}

		this.dbg('listen');
		this.auth.memberSubject													// this.auth will call complete() after first emit
			.pipe(
				first(info => !isNull(info)),								// subscribe until the first non-null response
				delay(5000),																// or if no response in 5 seconds.
			)
			.subscribe(info => this.getAuthProfile(info))
	}

	async setPlan(plan: PLAN, dt?: TInstant) {
		const doc = {
			[FIELD.effect]: getStamp(dt),
			[FIELD.store]: STORE.profile,
			[FIELD.type]: PROFILE.plan,
			[STORE.plan]: plan
		} as ProfilePlan;
		this.dbg('plan: %j', doc);

		return this.data.insDoc(doc, undefined, 'plan')
			.catch(err => this.dbg('setPlan: %j', err.message))
	}

	/** Create a new TopUp payment  */
	async setPayment(amount?: number, stamp?: TInstant) {
		const data = await this.getAccount();
		const plan = data.member.plan[0];

		/**
		 * If Plan has a 'bump' field, then auto-bump to new Plan  
		 * 	(e.g. a Member signs-up to an 'intro' Plan and uses-up its alloted value  
		 * 	then auto-bump them to a new Plan on next check-in)
		 */
		const topUp = ('bump' in plan && data.account.payment.length !== 0 && plan.bump !== plan.plan)
			? await this.upgradePlan(plan, stamp)
			: await this.getPayPrice(data)

		return {
			[FIELD.id]: this.data.newId,									// in case we need to update a Payment within a Batch
			[FIELD.store]: STORE.payment,
			[FIELD.type]: PAYMENT.topUp,
			[FIELD.stamp]: getStamp(stamp),
			amount: amount ?? topUp,
		} as Payment
	}

	private async upgradePlan(plan: ProfilePlan, stamp?: TInstant) {				// auto-bump 'intro' to 'member'
		const prices = await this.data.getStore<Price>(STORE.price, [
			addWhere(FIELD.type, PRICE.topUp),
			addWhere(FIELD.key, plan.bump),
		], getStamp(stamp))
		const topUp = asAt(prices, undefined, stamp)[0];// the current Member topUp

		this.setPlan(plan.bump!, stamp);								// expire 'intro', effect 'member'
		return topUp.amount;
	}

	/** Current Account status */
	getAccount = async (date?: TInstant) => {
		return this.state.getAccountData(date)
			.pipe(take(1))
			.toPromise()
	}

	getAmount = async (data?: AccountState) => {
		data = data || await this.getAccount();
		return data.account.summary;
	}

	// create / update accountDoc and stash into creates[]/updates[]
	setAccount = async (creates: StoreMeta[] = [], updates: StoreMeta[] = [], data?: AccountState) => {
		data = data || await this.getAccount();
		const uid = await this.data.getUID();
		const [summary, doc] = await Promise.all([
			this.getAmount(data),
			this.data.getStore<StatusAccount>(STORE.status, [addWhere(FIELD.uid, uid), addWhere(FIELD.type, STATUS.account)]),
		]);
		const accountDoc: Partial<StatusAccount> = !doc.length
			? {																// scaffold a new Account doc
				[FIELD.store]: STORE.status,
				[FIELD.type]: STATUS.account,
				[FIELD.uid]: uid,
				[FIELD.stamp]: getStamp(),
				summary,
			}
			: { ...doc[0], [FIELD.stamp]: getStamp(), summary }

		if (!accountDoc[FIELD.id])
			creates.push(accountDoc as StoreMeta)
		else updates.push(accountDoc as StoreMeta)

		return accountDoc;
	}

	updAccount = async (data?: AccountState) => {
		const creates: StoreMeta[] = [];
		const updates: StoreMeta[] = [];

		await this.setAccount(creates, updates, data);
		return this.data.batch(creates, updates);
	}

	getPlan = async (data?: AccountState) => {
		data = data || await this.getAccount();
		return data.member.plan[0];
	}

	getEventPrice = async (event: string, data?: AccountState) => {
		data = data || (await this.getAccount());
		const profile = data.member.plan[0];						// the member's plan
		const classDoc = await this.state.getSingle<Class>(STORE.class, addWhere(FIELD.key, event));

		return data.client.price												// look in member's prices for a match in 'span' and 'plan'
			.filter(row => row[FIELD.type] === classDoc[FIELD.type] as unknown as PRICE && row[FIELD.key] === profile.plan)[0].amount || 0;
	}

	/** Determine this member's topUp amount */
	getPayPrice = async (data?: AccountState) => {
		data = data || await this.getAccount();

		return data.client.price
			.filter(row => row[FIELD.type] === PRICE.topUp)[0].amount || 0;
	}

	/** check for change of User.additionalInfo */
	async getAuthProfile(info: firebase.auth.AdditionalUserInfo | null, uid?: string) {
		if (!info)
			return;																				// No AdditionalUserInfo available
		this.dbg('info: %s', info.providerId);

		const memberInfo = getMemberInfo(info);
		const profileInfo: Partial<ProfileInfo> = {
			[FIELD.store]: STORE.profile,
			[FIELD.type]: PROFILE.info,
			[FIELD.effect]: getStamp(),										// TODO: remove this when API supports local getMeta()
			[FIELD.uid]: uid || (await this.data.getActiveID()),
			[PROFILE.info]: { ...memberInfo },						// spread the conformed member info
		}
		const where = addWhere(`${PROFILE.info}.providerId`, info.providerId);

		this.data.insDoc(profileInfo as ProfileInfo, where, PROFILE.info);
	}

}
