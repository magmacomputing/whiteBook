import { Component, OnInit } from '@angular/core';

import { StateService } from '@dbase/state/state.service';
import { MemberService } from '@dbase/app/member.service';
import { ILocation } from '@dbase/data/data.schema';

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
  public selectedIndex: number = 0;                         // used by UI to swipe between <tabs>
  private locations: ILocation[] = [];
  
  public timetable$ = this.state.getScheduleData(this.date);

  constructor(private readonly member: MemberService, public readonly state: StateService) { }

  ngOnInit() {                                              // wire-up the Observables
    // this.state.getMemberData(this.date).subscribe(member => this.dbg('profile: %j', member));
    this.state.getScheduleData(this.date).subscribe(schedule => this.dbg('schedule: %j', schedule));
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