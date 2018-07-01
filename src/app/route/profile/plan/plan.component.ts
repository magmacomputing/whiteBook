import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';

import { Select } from '@ngxs/store';
import { ISelector } from '@dbase/state/store.define';
import { ClientState } from '@dbase/state/client.state';
import { getStore } from '@dbase/state/store.state';

import { MemberService } from '@dbase/app/member.service';
import { STORE } from '@dbase/data/data.define';

@Component({
  selector: 'wb-plan',
  templateUrl: './plan.component.html',
})
export class PlanComponent implements OnInit {
  @Select(ClientState.getClient) client$!: Observable<ISelector>;

  constructor(private readonly member: MemberService) { }

  ngOnInit() { }

  get price$() {
    return getStore(this.client$, STORE.price, 'topUp', 'order', 'plan');
  }
}
