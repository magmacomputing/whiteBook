import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { MemberService } from '@service/member/member.service';
import { DialogService } from '@service/material/dialog.service';

import { PlanState } from '@dbase/state/state.define';
import { StateService } from '@dbase/state/state.service';
import { FIELD, PRICE } from '@dbase/data.define';
import { Price, Plan } from '@dbase/data.schema';

import { isUndefined } from '@library/type.library';
import { padString } from '@library/string.library';
import { dbg } from '@library/logger.library';

@Component({
	selector: 'wb-plan',
	templateUrl: './plan.component.html',
})
export class PlanComponent implements OnInit {
	public data$!: Observable<PlanState>;
	#dbg = dbg(this);

	constructor(public readonly member: MemberService, private readonly state: StateService, public dialog: DialogService) { }

	ngOnInit() {
		this.data$ = this.state.getPlanData().pipe(
			map(source => {
				source.client.plan = source.client.plan.filter(row => !row[FIELD.hidden])
				return source;
			})
		)
	}

	/** Describe the clicked Plan */
	showPlan(plan: Plan, prices: Price[]) {
		const image = plan.image;
		const title = plan[FIELD.key];
		const subtitle = `${plan.note}${isUndefined(plan.rule) ? '' : ', ' + plan.rule}`;
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
				if (price[FIELD.type] === PRICE.topUp && price.amount)
					content.push(`$${padString(price.amount)} to topUp your account`);
				if (price[FIELD.type] === PRICE.hold)
					content.push(`$${padString(price.amount)} to put funds on-hold for 90-days`)
				if (price[FIELD.type] === PRICE.full)
					content.push(`$${padString(price.amount)} for a one-hour Class`);
				if (price[FIELD.type] === PRICE.half)
					content.push(`$${padString(price.amount)} for a half-hour Class`)
			})

		this.dialog.open({ image, title, subtitle, actions, content });
	}
}
