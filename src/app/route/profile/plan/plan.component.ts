import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';

import { Select } from '@ngxs/store';
import { ISelector, IStoreDoc } from '@dbase/state/store.define';
import { ClientState } from '@dbase/state/client.state';
import { getStore } from '@dbase/state/store.state';

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
  @Select() auth$!: Observable<IAuthState>;

  constructor(private readonly member: MemberService) { }

  ngOnInit() { }

  get price$() {
    return getStore(this.client$, STORE.price, undefined, 'plan');
  }

  get plan$() {
    return getStore(this.client$, STORE.plan);
  }

  get profile$() {
    return getStore(this.member$, STORE.profile, 'plan');
  }
}
