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

				if (price < myTopUp && !isAdmin)
					plan[FIELD.disable] = true;                         // special: dont allow downgrades in price

				if (myPlan && plan[FIELD.key] === 'intro' && !isAdmin)
					plan[FIELD.hidden] = true;                          // special: Intro is only available to new Members

				if (plan[FIELD.key] === 'pension') {
					if (myAge < 60 && !isAdmin)
						plan[FIELD.hidden] = true;
					else {                                              // special: Pension is only available to senior Member
						plan[FIELD.disable] = false;
						plan[FIELD.hidden] = false;
					}
				}

				if (plan[FIELD.key] === myPlan)
					plan[FIELD.disable] = true;                         // disable their current Plan, so cannot re-select

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
