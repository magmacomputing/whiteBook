import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { Select } from '@ngxs/store';
import { IStoreState } from '@dbase/state/store.define';

import { MemberService } from '@dbase/app/member.service';
import { STORE, FIELD } from '@dbase/data/data.define';
import { ILocation, IDefault } from '@dbase/data/data.schema';


import { suffix } from '@lib/number.library';
import { swipe } from '@lib/html.library';
import { dbg } from '@lib/logger.library';
import { fmtDate } from '@lib/date.library';
import { IWhere } from '@dbase/fire/fire.interface';
import { asAt } from '@dbase/app/app.library';
import { sortKeys } from '@lib/object.library';

@Component({
  selector: 'wb-attend',
  templateUrl: './attend.component.html',
  styleUrls: ['./attend.component.css']
})
export class AttendComponent implements OnInit {
  // @Select(AuthState.getUser) auth$!: Observable<IAuthState>;
  @Select((state: any) => state.client) client$!: Observable<IStoreState>;
  // @Select(MemberState.getMember) member$!: Observable<ISelector>;
  // @Select((state: any) => currStore(state.client, STORE.provider, undefined, ['start'])) schedule$!: Observable<ISchedule[]>;

  private dbg: Function = dbg.bind(this);
  private date!: string;
  public selectedIndex: number = 0;            // used by UI to swipe between <tabs>

  private locations: ILocation[] = [];
  private default: { [type: string]: string } = {};

  constructor(private readonly member: MemberService) { }

  ngOnInit() { }

  // get class$() {
  //   return getStore(this.client$, STORE.class).pipe(
  //     map(table => asAt(table, undefined, this.date))
  //   )
  // }

  // get profile$() {                // get the Member's current Plan
  //   const filter: IWhere = { fieldPath: FIELD.type, value: 'plan' }
  //   return getStore(this.member$, STORE.profile, filter);
  // }

  // get price$() {                  // get the Member's applicable Prices
  //   return this.profile$.pipe(
  //     // map(profiles => profiles[0]),
  //     // map(profile => profile.plan),
  //     // switchMap(plan => getStore(this.client$, STORE.price, { fieldPath: FIELD.key, value: plan })),
  //     map(table => asAt(table, undefined, this.date)),
  //   )
  // }

  get schedule$() {
    const day = fmtDate(this.date).weekDay;
    const where: IWhere = { fieldPath: 'day', value: day };

    return this.client$.pipe(
      map((state: IStoreState) => state[STORE.schedule]),
      map(table => asAt(table, where, this.date)),                    // get the Schedule for this.date
      map(table => table.sort(sortKeys('start'))),
    )

    // return currStore(this.client$, STORE.schedule).pipe(
    //   map((state: IStoreState) => state[STORE.schedule]),
    //   map(table => asAt<ISchedule>(table, where, this.date)),          // get the Schedule for this.date
    //   // mergeMap(table => this.class$, (schedule, events) => { // get the Classes
    //   //   return schedule.map(itm => { itm.class = events.filter(event => event[FIELD.key] === itm[FIELD.key])[0]; return itm; })
    //   // }),
    //   // mergeMap(table => this.price$, (schedule, prices) => {
    //   //   return schedule.map(itm => { itm.price = prices.filter(price => price[FIELD.type] === itm.class.type)[0]; return itm; })
    //   // }),
    //   map(table => table.sort(sortKeys('start'))),
    // )
  }

  get default$() {
    return this.client$.pipe(
      map((state: IStoreState) => state[STORE.default]),
      map((table: IDefault[]) => table.forEach(row => this.default[row[FIELD.type]] = row[FIELD.key])),
    )
  }

  // get location$() {                             // get the Locations that are on the Schedule for this.date
  //   return this.schedule$.pipe(
  //     map((table: ISchedule[]) => table.map(row => row.location || this.default.location)),
  //     distinct(),
  //     switchMap(locs => currStore(this.client$, STORE.location, { fieldPath: FIELD.key, value: locs })),
  //     tap((locs: ILocation[]) => this.locations = locs)
  //   )
  // }

  // TODO: popup info about a Class
  // showEvent(event: string) {
  //   this.dbg('event: %j', event);
  // }

  swipe(idx: number, event: any) {
    this.selectedIndex = swipe(idx, this.locations.length, event);
  }

  suffix(idx: number) {
    return suffix(idx);
  }
}