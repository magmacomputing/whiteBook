import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';

import { StateService } from '@dbase/state/state.service';
import { MemberService } from '@dbase/app/member.service';
import { ILocation } from '@dbase/data/data.schema';

import { swipe } from '@lib/html.library';
import { suffix } from '@lib/number.library';
import { dbg } from '@lib/logger.library';

@Component({
  selector: 'wb-attend',
  templateUrl: './attend.component.html',
  styleUrls: ['./attend.component.css']
})
export class AttendComponent implements OnInit {
  public timetable$!: Observable<any>;

  private dbg: Function = dbg.bind(this);
  private date!: string;
  public selectedIndex: number = 0;                         // used by UI to swipe between <tabs>
  private locations: ILocation[] = [];

  constructor(private readonly member: MemberService, public readonly state: StateService) { }

  ngOnInit() {                                              // wire-up the Observables
    this.state.getMemberData().subscribe(member => this.dbg('profile: %j', member));
    this.state.getScheduleData().subscribe(schedule => this.dbg('schedule: %j', schedule));

    this.timetable$ = this.state.getScheduleData();
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