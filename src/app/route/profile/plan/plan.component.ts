import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { filter } from 'rxjs/operators';

import { Select } from '@ngxs/store';
import { ISelector } from '@dbase/state/store.define';
import { getStore } from '@dbase/state/store.state';
import { AuthState } from '@dbase/state/auth.state';
import { ClientState } from '@dbase/state/client.state';

import { MemberService } from '@dbase/app/member.service';
import { MemberState } from '@dbase/state/member.state';
import { IAuthState } from '@dbase/state/auth.define';
import { STORE } from '@dbase/data/data.define';

import { dbg } from '@lib/logger.library';

@Component({
  selector: 'wb-plan',
  templateUrl: './plan.component.html',
})
export class PlanComponent implements OnInit {
  @Select(ClientState.getClient) client$!: Observable<ISelector>;
  @Select(MemberState.getMember) member$!: Observable<ISelector>;
  @Select(AuthState.getUser) auth$!: Observable<IAuthState>;

  private dbg: Function = dbg.bind(this);

  constructor(private readonly member: MemberService) { }

  ngOnInit() { }

  get profile$() {                // get the Member's current Plan
    return getStore(this.member$, STORE.profile, { fieldPath: 'type', opStr: '==', value: 'plan' });
  }

  price$(plan: string) {          // get the Prices for a nominated Plan
    return getStore(this.client$, STORE.price, { fieldPath: 'plan', opStr: '==', value: plan }, ['type']);
  }

  get plan$() {                   // get the available Plans
    return getStore(this.client$, STORE.plan, undefined, ['order', 'type']);
  }

  getPrice(plan: string) {
   
  }
}
