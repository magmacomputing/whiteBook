import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';

import { StateService, IPlanState } from '@dbase/state/state.service';
import { MemberService } from '@dbase/app/member.service';

import { IPrice } from '@dbase/data/data.schema';
import { FIELD } from '@dbase/data/data.define';
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
    this.data$ = this.state.getPlanData();
  }

  showPlan(plan: string, price: IPrice[]) {
    this.dbg('show: %j', price.filter(price => price[FIELD.key] === plan));
  }
}
