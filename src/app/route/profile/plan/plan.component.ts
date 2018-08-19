import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';

import { Select, Store } from '@ngxs/store';
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
  @Select(AuthState) auth$!: Observable<IAuthState>;
  @Select(ClientState.current(STORE.plan, undefined, ['sort', FIELD.key])) plan$!: Observable<IPlan[]>;
  @Select(MemberState.current(STORE.profile, { fieldPath: FIELD.type, value: 'plan' })) profile$!: Observable<IProfilePlan[]>;

  private dbg: Function = dbg.bind(this);

  constructor(private readonly member: MemberService, private readonly store: Store) { }

  ngOnInit() { }

  getPrice(plan: string) {
    const filter: IWhere[] = [
      { fieldPath: FIELD.key, value: plan },
      { fieldPath: FIELD.type, value: 'topUp' },
    ]
    return this.store.select(ClientState.store(STORE.price, filter));
  }

  showPlan(plan: string) {
    this.dbg('show: %s', plan)
  }
}
