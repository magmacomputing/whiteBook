import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { Select } from '@ngxs/store';
import { ClientState } from '@state/client.state';

import { IProfilePlan } from '@dbase/app/app.interface';
import { FireService } from '@dbase/fire/fire.service';
import { dbg } from '@lib/logger.library';

@Component({
  selector: 'wb-plan',
  templateUrl: './plan.component.html',
})
export class PlanComponent implements OnInit {
  @Select(ClientState.plans) plan$!: Observable<IProfilePlan[]>;

  private dbg: Function = dbg.bind(this);

  constructor(private readonly fire: FireService) { }

  ngOnInit() { }

  setPlan(plan: string) {
    this.dbg('plan: %j', plan);
  }
}
