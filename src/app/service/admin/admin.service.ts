import { Injectable } from '@angular/core';
import { DBaseModule } from '@dbase/dbase.module';

import { DataService } from '@dbase/data/data.service';
import { MemberService } from '@service/member/member.service';

import { FIELD, STORE } from '@dbase/data/data.define';
import { IStoreMeta, IGift } from '@dbase/data/data.schema';

import { getStamp, TDate, getDate } from '@lib/date.library';
import { asArray } from '@lib/array.library';
import { dbg } from '@lib/logger.library';

/**
 * Maintain the /client Collection.  
 * for example, add to Calendar, set Pricing, alter Schedule...  
 * User must have role = 'admin' or 'instructor'
 */
@Injectable({ providedIn: DBaseModule })
export class AdminService {
	private dbg = dbg(this);

	constructor(private data: DataService, private member: MemberService) { this.dbg('new') }

	/** Check if active Member Payment expiry date has passed */
	expirePayment = async (uid: string) => {
		const stamp = getStamp();
		const data = await this.member.getAccount();
		const active = data.account.payment;
		const creates: IStoreMeta[] = [];
		const updates: IStoreMeta[] = [];

		asArray(active).forEach(async (pay, idx) => {
			if (pay.expiry && pay.expiry < stamp && !pay[FIELD.expire]) {
				updates.push({ ...pay, [FIELD.expire]: stamp });
				if (idx === 0 && data.account.summary.credit) {
					const lapse = await this.member.setPayment(-data.account.summary.funds);
					creates.push({ ...lapse, [FIELD.effect]: stamp });
				}
			}
		});

		return this.data.batch(creates, updates);
	}

	/** Add a Gift to a Member's account to use in future check-ins */
	addGift = async (uid: string, count: number, type?: string, start?: TDate, expiry?: TDate) => {
		return this.data.setDoc(STORE.gift, {
			[FIELD.effect]: getDate(start).startOf('day').ts,
			[FIELD.store]: STORE.gift,
			[FIELD.type]: type,
			[FIELD.uid]: uid,
			stamp: getStamp(),
			expiry: expiry,
			count: count,
		} as IGift)
	}

}
