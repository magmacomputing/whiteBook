import { Injectable } from '@angular/core';
import { take } from 'rxjs/operators';

import { addWhere } from '@dbase/fire/fire.library';
import { StateService } from '@dbase/state/state.service';
import { IAccountState } from '@dbase/state/state.define';

import { STORE, FIELD } from '@dbase/data/data.define';
import { DBaseModule } from '@dbase/dbase.module';
import { IClass } from '@dbase/data/data.schema';

import { getDate, TDate } from '@lib/date.library';
import { dbg } from '@lib/logger.library';

@Injectable({ providedIn: DBaseModule })
export class AttendService {
	private dbg = dbg(this);

	constructor(private state: StateService) { this.dbg('new') }

	/** loop back up-to-seven days to find when className was last scheduled */
	lkpDate = async (className: string, location?: string, date?: number) => {
		const timetable = await this.state.getTimetableData(date).toPromise();
		let now = getDate(date);													// start with date-argument
		let ctr = 0;

		if (!location)
			location = this.state.getDefault(timetable, STORE.location);

		for (ctr; ctr < 7; ctr++) {
			const classes = timetable.client.schedule!			// loop through schedule
				.filter(row => row.day === now.ww)						// finding a match in 'day'
				.filter(row => row[FIELD.key] === className)	// and match in 'class'
				.filter(row => row.location === location)			// and match in 'location'

			if (classes.length)															// is this class offered on this 'day'   
				break;
			now = now.add(-1, 'day');												// move pointer to previous day
		}

		if (ctr >= 7)																			// cannot find className on timetable
			now = getDate(date);														// so default back to today's date	

		return now.ts;																		// timestamp
	}

	/** Current Account status */
	getAccount = async (date?: TDate) => {
		return this.state.getAccountData(date)
			.pipe(take(1))
			.toPromise()
	}

	getAmount = async (data?: IAccountState) => {
		data = data || await this.getAccount();
		const { bank = 0, pend = 0, paid = 0, adjust = 0, spend = 0 } = data.account.summary;
		return { bank, pend, paid, adjust, spend, credit: bank + pend + paid - spend, funds: bank + paid + adjust - spend };
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
}