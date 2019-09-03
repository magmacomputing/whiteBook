import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { MemberService } from '@service/member/member.service';
import { DialogService } from '@service/material/dialog.service';

import { IPlanState } from '@dbase/state/state.define';
import { StateService } from '@dbase/state/state.service';
import { FIELD, TYPE } from '@dbase/data/data.define';
import { IPrice, IPlan } from '@dbase/data/data.schema';

import { isUndefined } from '@lib/type.library';
import { dbg } from '@lib/logger.library';

@Component({
	selector: 'wb-plan',
	templateUrl: './plan.component.html',
})
export class PlanComponent implements OnInit {
	public data$!: Observable<IPlanState>;
	private dbg = dbg(this);

	constructor(private readonly member: MemberService, private readonly state: StateService, public dialog: DialogService) { }

	ngOnInit() {
		this.data$ = this.state.getPlanData().pipe(
			map(source => {
				source.client.plan = source.client.plan.filter(row => !row[FIELD.hidden])
				return source;
			})
		)
	}

	/** Describe the clicked Plan */
	showPlan(plan: IPlan, prices: IPrice[]) {
		const image = plan.image;
		const title = plan[FIELD.key];
		const subtitle = `${plan.desc}${isUndefined(plan.rule) ? '' : ', ' + plan.rule}`;
		const actions = ['Close'];

		let content: string[] = [];
		content.push(plan.expiry
			? `Unused funds will expire ${plan.expiry} months after last Attendance.`
			: 'Your payment amount does not expire.'
		)
		content.push('-');											// blank line
		content.push('This plan is ' + (plan.bonus
			? 'entitled to Bonus schemes.'
			: 'not entitled to Bonus schemes.')
		)

		content.push('-');											// blank line
		content.push('Pricing...');
		prices
			.filter(row => row[FIELD.key] === plan[FIELD.key])
			.forEach(price => {
				if (price[FIELD.type] === TYPE.topUp && price.amount)
					content.push(`$${this.fixString(price.amount)} to topUp your account`);
				if (price[FIELD.type] === 'hold')
					content.push(`$${this.fixString(price.amount)} funds on-hold for 90-days`)
				if (price[FIELD.type] === 'full')
					content.push(`$${this.fixString(price.amount)} for a one-hour Class`);
				if (price[FIELD.type] === 'half')
					content.push(`$${this.fixString(price.amount)} for a half-hour Class`)
			})

		this.dialog.open({ image, title, subtitle, actions, content });
	}

	private fixString(nbr: number) {
		return nbr.toFixed(2).padStart(6, '\u007F');
	}
}
