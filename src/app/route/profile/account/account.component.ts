import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';

import { MemberService } from '@dbase/app/member.service';
import { StateService } from '@dbase/state/state.service';
import { IMemberState } from '@dbase/state/state.library';

import { dbg } from '@lib/logger.library';

@Component({
  selector: 'wb-account',
  templateUrl: './account.component.html',
})
export class AccountComponent implements OnInit {
  public data$: Observable<IMemberState> = this.state.getMemberData();
  private dbg: Function = dbg.bind(this);

  constructor(readonly state: StateService, readonly member: MemberService) { }

  ngOnInit() {
    this.data$.subscribe(data => {
      this.dbg('data: %j', data);
    })
  }

}
