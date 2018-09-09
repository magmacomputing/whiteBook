import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { IPlanState } from '@dbase/state/state.library';
import { StateService } from '@dbase/state/state.service';
import { MemberService } from '@dbase/app/member.service';

import { IPrice } from '@dbase/data.schema';
import { FIELD } from '@dbase/data.define';
import { dbg } from '@lib/logger.library';

@Component({
  selector: 'wb-plan',
  templateUrl: './plan.component.html',
})
export class PlanComponent implements OnInit {
  public data$!: Observable<IPlanState>;
  private dbg: Function = dbg.bind(this);

  constructor(private readonly member: MemberService, private readonly state: StateService) { }

  ngOnInit() {
    this.data$ = this.state.getPlanData().pipe(
      map(data => {
        const currentPlan = data.member.plan;
        const claim = data.auth.claims;
        const isAdmin = claim && claim.claims && claim.claims.roles && claim.claims.roles.includes('admin');
        let plans = data.client.plan;                       // array of available plans

        if (currentPlan && !isAdmin) {                      // Special: dont allow downgrades
          const currentTopUp = data.client.price            // find the current members topUp price
            .filter(price => price[FIELD.key] === currentPlan.plan && price[FIELD.type] === 'topUp')[0];

          plans = plans.map(plan => {
            const planPrice = data.client.price
              .filter(price => price[FIELD.type] === 'topUp')[0];

            plan[FIELD.hidden] = plan[FIELD.hidden] || (planPrice.amount < currentTopUp.amount);
            return plan;
          })
          // plans = plans
          //   .map(plan => Object.assign({ [FIELD.disable]: plan[FIELD.type] === 'topUp' && plan.}))
          // plans = plans.map(plan => Object.assign({ [FIELD.hidden]: plan[FIELD.key] === 'intro' }, plan));
        }

        return Object.assign(data, { plan: plans });
      })
    )
  }

  showPlan(plan: string, price: IPrice[]) {
    this.dbg('show: %j', price.filter(price => price[FIELD.key] === plan));
  }
}
