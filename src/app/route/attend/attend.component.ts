import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { map, tap, distinct, switchMap } from 'rxjs/operators';

import { Select } from '@ngxs/store';
import { ISelector } from '@dbase/state/store.define';
import { ClientState } from '@dbase/state/client.state';
import { getStore } from '@dbase/state/store.state';

import { MemberService } from '@dbase/app/member.service';
import { asAt } from '@dbase/app/member.library';
import { STORE, FIELD } from '@dbase/data/data.define';
import { IClass, ISchedule } from '@dbase/data/data.interface';
import { IWhere } from '@dbase/fire/fire.interface';

import { fmtDate } from '@lib/date.library';
import { sortKeys } from '@lib/object.library';
import { dbg } from '@lib/logger.library';

@Component({
  selector: 'wb-attend',
  templateUrl: './attend.component.html',
  styleUrls: ['./attend.component.css']
})
export class AttendComponent implements OnInit {
  @Select(ClientState.getClient) client$!: Observable<ISelector>;

  private dbg: Function = dbg.bind(this);
  private date!: string;

  constructor(private readonly member: MemberService) { }

  ngOnInit() { }

  get event$() {
    return getStore(this.client$, STORE.class).pipe(
      map(table => asAt(table, undefined, this.date))
    )
  }

  get schedule$() {
    const day = fmtDate(this.date).weekDay;
    const where: IWhere = { fieldPath: 'day', opStr: '==', value: day };

    return getStore(this.client$, STORE.schedule).pipe(
      map(table => asAt(table, where, this.date)),
      map(table => table.sort(sortKeys('time'))),
    )
  }

  get location$() {                             // get the Locations that are on the Schedule for this.date
    let locs: string[] = [];
    const where: IWhere[] = [];

    return this.schedule$.pipe(
      map((table: ISchedule[]) => table.map(row => row.location)),
      distinct(),
      tap(res => locs = res),
      tap(locs => locs.forEach(loc => where.push({ fieldPath: FIELD.key, opStr: '==', value: loc }))),
      switchMap(_ => getStore(this.client$, STORE.location, where)),
    )
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