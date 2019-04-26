import { Injectable } from '@angular/core';
import { DBaseModule } from '@dbase/dbase.module';

import { DataService } from '@dbase/data/data.service';

import { dbg } from '@lib/logger.library';
import { MemberService } from '@service/member/member.service';
import { IStoreMeta } from '@dbase/data/data.schema';
import { getStamp } from '@lib/date.library';
import { FIELD } from '@dbase/data/data.define';
import { asArray } from '@lib/array.library';

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

}
