import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';

import { Select } from '@ngxs/store';
import { ISelector } from '@dbase/state/store.define';
import { ClientState } from '@dbase/state/client.state';
import { getStore } from '@dbase/state/store.state';

import { MemberService } from '@dbase/app/member.service';
import { STORE } from '@dbase/data/data.define';
import { IClass } from '@dbase/data/data.interface';
import { dbg } from '@lib/logger.library';

@Component({
  selector: 'wb-attend',
  templateUrl: './attend.component.html',
  styleUrls: ['./attend.component.css']
})
export class AttendComponent implements OnInit {
  @Select(ClientState.getClient) client$!: Observable<ISelector>;

  private dbg: Function = dbg.bind(this);

  constructor(private readonly member: MemberService) { }

  ngOnInit() { }

  get event$() {
    return getStore(this.client$, STORE.class);
  }

  checkIn(event: IClass) {
    this.dbg('event: %j', event);
  }
}

/**
 * get class, plan, uid, and profile
 * use uid to get profile.plan
 * use profile.plan to get price (for each type)
 * use (dt?) to get class
 * use class.type (full/half) to show cost
 */