import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';

import { Select } from '@ngxs/store';
import { ISelector } from '@dbase/state/store.define';
import { getStore } from '@dbase/state/store.state';
import { AuthState } from '@dbase/state/auth.state';
import { ClientState } from '@dbase/state/client.state';

import { MemberService } from '@dbase/app/member.service';
import { MemberState } from '@dbase/state/member.state';
import { IAuthState } from '@dbase/state/auth.define';
import { STORE } from '@dbase/data/data.define';

@Component({
  selector: 'wb-plan',
  templateUrl: './plan.component.html',
})
export class PlanComponent implements OnInit {
  @Select(ClientState.getClient) client$!: Observable<ISelector>;
  @Select(MemberState.getMember) member$!: Observable<ISelector>;
  @Select(AuthState.getUser) auth$!: Observable<IAuthState>;

  constructor(private readonly member: MemberService) { }

  ngOnInit() { }

  price$(plan: string) {
    return getStore(this.client$, STORE.price, plan, 'type');
  }

  get plan$() {
    return getStore(this.client$, STORE.plan, undefined, 'order', 'type');
  }

  get profile$() {
    return getStore(this.member$, STORE.profile, 'plan');
  }
}
