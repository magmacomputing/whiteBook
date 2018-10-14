import { Component, OnInit } from '@angular/core';
import { map } from 'rxjs/operators';

import { StateService } from '@dbase/state/state.service';
import { MemberService } from '@dbase/app/member.service';
import { getMemberAge } from '@dbase/app/member.library';

import { IPrice } from '@dbase/data/data.schema';
import { FIELD } from '@dbase/data/data.define';
import { dbg } from '@lib/logger.library';

@Component({
	selector: 'wb-plan',
	templateUrl: './plan.component.html',
})
export class PlanComponent implements OnInit {
	public data$ = this.state.getPlanData();
	private dbg: Function = dbg.bind(this);

	constructor(private readonly member: MemberService, private readonly state: StateService) { }

	ngOnInit() {
		this.data$.pipe(map(data => {
			const claim = data.auth.claims;
			const isAdmin = claim && claim.claims && claim.claims.roles && claim.claims.roles.includes('admin');
			const myPlan = data.member.plan && data.member.plan[0].plan;
			const myTopUp = data.member.price && data.member.price.filter(price => price[FIELD.type] === 'topUp')[0].amount || 0;
			const myAge = getMemberAge(data.member.info);

			const plans = data.client.plan.map(plan => {            // array of available Plans
				const price = data.client.price                       // get the topUp for this Plan
					.filter(price => price[FIELD.key] === plan[FIELD.key] && price[FIELD.type] === 'topUp')[0].amount;

				if (price < myTopUp && !isAdmin)                      // Special: dont allow downgrades in price
					plan[FIELD.disable] = true;

				if (plan[FIELD.key] === 'intro')											// Special: Intro is only available to new Members
					plan[FIELD.hidden] = (myPlan && !isAdmin) ? true : false;

				if (plan[FIELD.key] === 'pension')										// Special: Pension is only available to senior Member
					plan[FIELD.hidden] = (myAge < 60 && !isAdmin) ? true : false;

				if (plan[FIELD.key] === myPlan)                       // disable their current Plan, so cannot re-select
					plan[FIELD.disable] = true;

				return plan
			});

			data.client.plan = plans;                               // override the available Plans
			return { ...data };
		}))
	}

	showPlan(plan: string, price: IPrice[]) {
		this.dbg('show: %j', price.filter(price => price[FIELD.key] === plan));
	}
}
