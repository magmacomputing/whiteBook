import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { map, distinct, switchMap } from 'rxjs/operators';

import { Select } from '@ngxs/store';
import { IStoreState } from '@dbase/state/store.define';
import { IAuthState } from '@dbase/state/auth.define';

import { DBaseService } from '@dbase/app/dbase.service';
import { MemberService } from '@dbase/app/member.service';
import { STORE, FIELD } from '@dbase/data/data.define';
import { ILocation, IDefault, ISchedule } from '@dbase/data/data.schema';


import { swipe } from '@lib/html.library';
import { suffix } from '@lib/number.library';
import { fmtDate } from '@lib/date.library';
import { asAt } from '@dbase/app/app.library';
import { sortKeys } from '@lib/object.library';
import { dbg } from '@lib/logger.library';

@Component({
  selector: 'wb-attend',
  templateUrl: './attend.component.html',
  styleUrls: ['./attend.component.css']
})
export class AttendComponent implements OnInit {
  @Select((state: any) => state.auth) auth$!: Observable<IAuthState>;
  @Select((state: any) => state.client) client$!: Observable<IStoreState>;
  @Select((state: any) => state.member) member$!: Observable<IStoreState>;

  public schedule$!: Observable<ISchedule[]>;
  public location$!: Observable<ILocation[]>;
  // public default$!: Observable<IDefault[]>;
  // public profile$!: Observable<any>;

  private dbg: Function = dbg.bind(this);
  private date!: string;
  public selectedIndex: number = 0;                         // used by UI to swipe between <tabs>
  private locations: ILocation[] = [];

  constructor(private readonly member: MemberService, public readonly dbase: DBaseService) { }

  ngOnInit() {                                              // wire-up the Observables
    this.dbase.getMemberData().subscribe(member => this.dbg('profile: %j', member));
    this.dbase.getDefault().subscribe(defaults => this.dbg('default: %j', defaults ));

    this.schedule$ = this.client$.pipe(
      map((state: IStoreState) => state[STORE.schedule] as ISchedule[]),
      map(table => asAt(table, { fieldPath: 'day', value: fmtDate(this.date).weekDay }, this.date)),
      map(table => table.sort(sortKeys(['start']))),
    )
    this.location$ = this.schedule$.pipe(
      map(table => table.map(row => row.location)),
      distinct(),
      switchMap(locn => this.client$.pipe(
        map((state: IStoreState) => state[STORE.location] as ILocation[]),
        map(table => table.filter(row => locn.includes(row[FIELD.key]))),
        map(table => table.sort(sortKeys(['sort']))),
      ))
    )
  }

  // TODO: popup info about a Class
  showEvent(event: string) {
    this.dbg('event: %j', event);
  }

  swipe(idx: number, event: any) {
    this.selectedIndex = swipe(idx, this.locations.length, event);
  }

  suffix(idx: number) {
    return suffix(idx);
  }
}