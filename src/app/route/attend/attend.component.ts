import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { ITimetableState } from '@dbase/state/state.library';
import { StateService } from '@dbase/state/state.service';
import { MemberService } from '@dbase/app/member.service';

import { FIELD } from '@dbase/data/data.define';
import { IPrice } from '@dbase/data/data.schema';

import { swipe } from '@lib/html.library';
import { suffix } from '@lib/number.library';
import { dbg } from '@lib/logger.library';

@Component({
  selector: 'wb-attend',
  templateUrl: './attend.component.html',
})
export class AttendComponent implements OnInit {
  private dbg: Function = dbg.bind(this);
  private date!: number;

  public selectedIndex: number = 0;                   // used by UI to swipe between <tabs>
  public locations: number = 0;                       // used by UI to swipe between <tabs>
  public timetable$!: Observable<ITimetableState>;

  constructor(private readonly member: MemberService, public readonly state: StateService) { }

  ngOnInit() {                                        // wire-up the timetable Observable
    this.timetable$ = this.state.getTimetableData(this.date).pipe(
      map(data => {
        const sched = data.client.schedule || [];     // the schedule for today
        const event = data.client.class || [];        // the classes offered this.date
        const price = data.member.price || [];        // the prices per member's plan
        const costs: IPrice[] = [];                   // the price for a schedule item

        sched.forEach((time, idx) => {
          const span = event.filter(itm => itm[FIELD.key] === time[FIELD.key])[0][FIELD.type];
          const cost = price.filter(itm => itm[FIELD.type] === span)[0];

          costs[idx] = cost;                          // stash the IPrice for each scheduled event
        })
        
        this.locations = (data.client.location || []).length;
        this.selectedIndex = 0;
        data.client.price = costs;
        this.dbg('locations: %s', this.locations);
        // this.dbg('data: %j', data);
        return data;
      })
    )
  }

  // TODO: popup info about a Class
  showEvent(event: string) {
    this.dbg('event: %j', event);
  }

  swipe(idx: number, event: any) {
    this.selectedIndex = swipe(idx, this.locations, event);
  }

  suffix(idx: number) {
    return suffix(idx);
  }
}