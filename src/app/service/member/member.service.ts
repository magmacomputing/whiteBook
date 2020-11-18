import { Injectable } from '@angular/core';
import { take, first, delay } from 'rxjs/operators';

import { DBaseModule } from '@dbase/dbase.module';
import { getMemberInfo } from '@service/member/member.library';
import { SnackService } from '@service/material/snack.service';
import { AccountState } from '@dbase/state/state.define';
import { StateService } from '@dbase/state/state.service';
import { DataService } from '@dbase/data/data.service';

import { asAt } from '@library/app.library';
import { fire } from '@dbase/fire/fire.library';
import { AuthState } from '@dbase/state/auth.state';
import { STORE, FIELD, PLAN, PRICE, PROFILE, STATUS, PAYMENT } from '@dbase/data.define';
import type { ProfilePlan, Payment, ProfileInfo, Class, FireDocument, Account, Price } from '@dbase/data.schema';

import { getStamp, Instant } from '@library/instant.library';
import { isNull } from '@library/type.library';
import { dbg } from '@library/logger.library';

@Injectable({ providedIn: DBaseModule })
export class MemberService {
	#dbg = dbg(this);

	constructor(private readonly data: DataService, private auth: AuthState, private state: StateService, private snack: SnackService) {
		this.#dbg('new');
		this.listenInfo(true);
	}

	public async listenInfo(init = false) {
		if (init) {
			if (!await this.data.auth.user)
				return;																			// dont listen from constructor if not signed-In
		}

		this.#dbg('listen');
		this.auth.memberSubject													// this.auth will call complete() after first emit
			.pipe(
				first(info => !isNull(info)),								// subscribe until the first non-null response
				delay(5000),																// or if no response in 5 seconds.
			)
			.subscribe(
				info => this.getAuthProfile(info),
				err => this.#dbg('listenInfo: %j', err.message),
			)
	}

	async setPlan(plan: PLAN, dt?: Instant.TYPE) {
		const doc = {
			[FIELD.Effect]: getStamp(dt),
			[FIELD.Store]: STORE.Profile,
			[FIELD.Type]: PROFILE.Plan,
			[STORE.Plan]: plan
		} as ProfilePlan;
		this.#dbg('plan: %j', doc);

		return this.data.insDoc(doc, undefined, 'plan')
			.catch(err => this.#dbg('setPlan: %j', err.message))
	}

	/** Create a new TopUp payment  */
	async setPayment(amount?: number, stamp?: Instant.TYPE) {
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
			// [FIELD.id]: this.data.newId,									// in case we need to update a Payment within a Batch
			[FIELD.Store]: STORE.Payment,
			[FIELD.Stamp]: getStamp(stamp),
			fee: [{
				[FIELD.Type]: PAYMENT.TopUp,
				amount: amount ?? topUp,
			}]
		} as Payment
	}

	private async upgradePlan(plan: ProfilePlan, stamp?: Instant.TYPE) {				// auto-bump 'intro' to 'member'
		const prices = await this.data.getStore<Price>(STORE.Price, [
			fire.addWhere(FIELD.Type, PRICE.TopUp),
			fire.addWhere(FIELD.Key, plan.bump),
		], getStamp(stamp))
		const topUp = asAt(prices, undefined, stamp)[0];// the current Member topUp

		this.setPlan(plan.bump!, stamp);								// expire 'intro', effect 'member'
		return topUp.amount;
	}

	/** Current Account status */
	getAccount = async (date?: Instant.TYPE) => {
		return this.state.getAccountData(date)
			.pipe(take(1))
			.toPromise()
	}

	getAmount = async (data?: AccountState) => {
		data = data || await this.getAccount();
		return data.account.summary;
	}

	// create / update accountDoc and stash into creates[]/updates[]
	setAccount = async (creates: FireDocument[] = [], updates: FireDocument[] = [], data?: AccountState) => {
		data = data || await this.getAccount();
		const uid = await this.data.getUID();
		const [summary, account] = await Promise.all([
			this.getAmount(data),
			this.data.getStore<Account>(STORE.Status, [fire.addWhere(FIELD.Uid, uid), fire.addWhere(FIELD.Type, STATUS.Account)]),
		]);
		const accountDoc: Partial<Account> = !account.length
			? {																// scaffold a new Account doc
				[FIELD.Store]: STORE.Status,
				[FIELD.Type]: STATUS.Account,
				[FIELD.Uid]: uid,
				[FIELD.Stamp]: getStamp(),
				summary,
			}
			: { ...account[0], [FIELD.Stamp]: getStamp(), summary }

		if (!accountDoc[FIELD.Id])
			creates.push(accountDoc as FireDocument)
		else updates.push(accountDoc as FireDocument)

		return accountDoc;
	}

	updAccount = async (data?: AccountState) => {
		const creates: FireDocument[] = [];
		const updates: FireDocument[] = [];

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
		const classDoc = await this.state.getSingle<Class>(STORE.Class, fire.addWhere(FIELD.Key, event));

		return data.client.price												// look in member's prices for a match in 'span' and 'plan'
			.filter(row => row[FIELD.Type] === classDoc[FIELD.Type] as unknown as PRICE && row[FIELD.Key] === profile.plan)[0].amount || 0;
	}

	/** Determine this member's topUp amount */
	getPayPrice = async (data?: AccountState) => {
		data = data || await this.getAccount();

		return data.client.price
			.filter(row => row[FIELD.Type] === PRICE.TopUp)[0].amount || 0;
	}

	/** check for change of User.additionalInfo */
	async getAuthProfile(info: firebase.default.auth.AdditionalUserInfo | null, uid?: string) {
		if (!info)
			return;																				// No AdditionalUserInfo available
		this.#dbg('info: %j', info);

		const memberInfo = getMemberInfo(info);
		const profileInfo: Partial<ProfileInfo> = {
			[FIELD.Store]: STORE.Profile,
			[FIELD.Type]: PROFILE.Info,
			[FIELD.Effect]: getStamp(),										// TODO: remove this when API supports local getMeta()
			[FIELD.Uid]: uid || (await this.data.getActiveID()),
			[PROFILE.Info]: { ...memberInfo },						// spread the conformed member info
		}
		const where = fire.addWhere(`${PROFILE.Info}.providerId`, info.providerId);

		this.data.insDoc(profileInfo as ProfileInfo, where, PROFILE.Info);
	}

}
