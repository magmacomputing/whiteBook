import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';

import { Select } from '@ngxs/store';
import { ISelector } from '@dbase/state/store.define';
import { getStore } from '@dbase/state/store.state';
import { AuthState } from '@dbase/state/auth.state';
import { IAuthState } from '@dbase/state/auth.define';
import { ClientState } from '@dbase/state/client.state';
import { MemberState } from '@dbase/state/member.state';

import { MemberService } from '@dbase/app/member.service';
import { STORE, FIELD } from '@dbase/data/data.define';
import { IProfilePlan, IPlan } from '@dbase/data/data.schema';
import { IWhere } from '@dbase/fire/fire.interface';

import { dbg } from '@lib/logger.library';

@Component({
  selector: 'wb-plan',
  templateUrl: './plan.component.html',
})
export class PlanComponent implements OnInit {
  @Select(ClientState.current) client$!: Observable<ISelector<any>>;
  @Select(MemberState.current) member$!: Observable<ISelector<any>>;
  @Select(AuthState.getUser) auth$!: Observable<IAuthState>;

  private dbg: Function = dbg.bind(this);

  constructor(private readonly member: MemberService) { }

  ngOnInit() { }

  get profile$() {                // get the Member's current Plan
    const filter: IWhere = { fieldPath: FIELD.type, value: 'plan' }
    return getStore<IProfilePlan>(this.member$, STORE.profile, filter);
  }

  get plan$() {                   // get the available Plans
    return getStore<IPlan>(this.client$, STORE.plan, undefined, ['sort', FIELD.key]);
  }

  getPrice(plan: string) {
    const filter: IWhere[] = [
      { fieldPath: FIELD.key, value: plan },
      { fieldPath: FIELD.type, value: 'topUp' },
    ]
    return getStore(this.client$, STORE.price, filter);
  }

  showPlan(plan: string) {
    this.dbg('show: %s', plan)
  }
}
