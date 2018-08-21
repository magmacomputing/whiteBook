import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { map, distinct, switchMap, filter } from 'rxjs/operators';

import { Select } from '@ngxs/store';
import { IStoreState } from '@dbase/state/store.define';
import { IAuthState } from '@dbase/state/auth.define';

import { MemberService } from '@dbase/app/member.service';
import { STORE, FIELD } from '@dbase/data/data.define';
import { ILocation, IDefault, ISchedule, IProfilePlan, IPlan, IPrice } from '@dbase/data/data.schema';
import { IWhere } from '@dbase/fire/fire.interface';

import { swipe } from '@lib/html.library';
import { suffix } from '@lib/number.library';
import { fmtDate } from '@lib/date.library';
import { asAt } from '@dbase/app/app.library';
import { sortKeys } from '@lib/object.library';
import { dbg } from '@lib/logger.library';
import { UserInfo } from '@firebase/auth-types';

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
  public default$!: Observable<IDefault[]>;
  public profile$!: Observable<any>;

  private dbg: Function = dbg.bind(this);
  private date!: string;
  public selectedIndex: number = 0;                         // used by UI to swipe between <tabs>
  private locations: ILocation[] = [];

  constructor(private readonly member: MemberService) { }

  ngOnInit() {                                              // wire-up the Observables
    this.profile$ = this.auth$.pipe(
      map(auth => auth.userInfo),                           // get the current User UID
      map((user: UserInfo) => {
        const { displayName, email, photoURL, providerId, uid } = user;
        return { displayName, email, photoURL, providerId, uid }
      }),
      switchMap(user => this.member$.pipe(                   // search the /member store for an effective ProfilePlan
        map((state: IStoreState) => asAt<IProfilePlan>(state[STORE.profile] as IProfilePlan[],
          [{ fieldPath: FIELD.type, value: 'plan' }, { fieldPath: FIELD.key, value: user.uid }], this.date)),
        map(table => Object.assign({}, { user }, { plan: table[0] }),// return only the first occurrence
        )),
      ),
      switchMap((result: any) => this.client$.pipe(         // get the prices[] for the effective ProfilePlan
        map((state: IStoreState) => asAt<IPrice>(state[STORE.price] as IPrice[],
          [{ fieldPath: FIELD.key, value: result.profile.plan }], this.date)),
        map(table => Object.assign({}, result, { price: table })),
      )),
    )
    this.profile$.subscribe(profile => this.dbg('profile: %j', profile));

    this.default$ = this.client$.pipe(
      map((state: IStoreState) => state[STORE.default] as IDefault[]),
    )

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