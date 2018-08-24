import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';

import { StateService, IPlanState } from '@dbase/state/state.service';
import { MemberService } from '@dbase/app/member.service';

import { dbg } from '@lib/logger.library';

@Component({
  selector: 'wb-plan',
  templateUrl: './plan.component.html',
})
export class PlanComponent implements OnInit {
  public planData$!: Observable<IPlanState>;
  private dbg: Function = dbg.bind(this);

  constructor(private readonly member: MemberService, private readonly state: StateService) { }

  ngOnInit() {
    this.planData$ = this.state.getPlanData();
    this.planData$.subscribe(data => this.dbg('data: %j', data));
  }

  showPlan(plan: string) {
    this.dbg('show: %s', plan);
  }
}
