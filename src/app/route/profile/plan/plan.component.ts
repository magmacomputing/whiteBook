import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { Select } from '@ngxs/store';
import { ClientState } from '@dbase/state/client.state';

import { IProfilePlan, IPrice } from '@dbase/data/data.interface';
import { COLLECTION, FIELD } from '@dbase/data/data.define';
import { DataService } from '@dbase/data/data.service';
import { dbg } from '@lib/logger.library';

@Component({
  selector: 'wb-plan',
  templateUrl: './plan.component.html',
})
export class PlanComponent implements OnInit {
  @Select(ClientState.plans) plan$!: Observable<IProfilePlan[]>;

  private dbg: Function = dbg.bind(this);

  constructor(private readonly data: DataService) { }

  ngOnInit() { }

  setPlan(price: IPrice) {
    this.dbg('price: %j', price);
    const planDoc: IProfilePlan = {
      [FIELD.id]: this.data.newId,                    // generate a new Id
      store: 'profile',
      type: 'plan',
      plan: price.plan,
    }

    this.dbg('plan: %j', planDoc);
    this.data.insDoc(COLLECTION.Member, planDoc);
  }
}
