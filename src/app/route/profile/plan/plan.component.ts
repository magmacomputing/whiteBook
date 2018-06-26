import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { Select } from '@ngxs/store';
import { IStoreDoc } from '@state/store.define';
import { ClientState } from '@state/client.state';

import { IAuthState } from '@dbase/auth/auth.define';
import { IProfilePlan } from '@dbase/data/data.interface';
import { COLLECTION } from '@dbase/data/data.define';
import { DataService } from '@dbase/data/data.service';
import { dbg } from '@lib/logger.library';

@Component({
  selector: 'wb-plan',
  templateUrl: './plan.component.html',
})
export class PlanComponent implements OnInit {
  @Select(ClientState.plans) plan$!: Observable<IProfilePlan[]>;
  @Select() auth$!: Observable<IAuthState>;

  private dbg: Function = dbg.bind(this);

  constructor(private readonly data: DataService) { }

  ngOnInit() { }

  setPlan(price: IStoreDoc) {
    this.dbg('price: %j', price);
    const planDoc: IProfilePlan = {
      store: 'profile',
      type: 'plan',
      plan: price.plan,
    }

    this.dbg('plan: %j', planDoc);
    this.data.insDoc(COLLECTION.Member, planDoc as IStoreDoc);
  }
}
