import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { ITimetableState } from '@dbase/state/state.define';
import { StateService } from '@dbase/state/state.service';
import { MemberService } from '@dbase/app/member.service';
import { DataService } from '@dbase/data/data.service';

import { FIELD, STORE } from '@dbase/data/data.define';
import { IPrice, IDefault, IClass, ISchedule } from '@dbase/data/data.schema';

import { swipe } from '@lib/html.library';
import { asArray } from '@lib/array.library';
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
	public firstPaint = true;                           // indicate first-paint

	constructor(private readonly member: MemberService, public readonly state: StateService, public readonly data: DataService) { }

	ngOnInit() {                                        // wire-up the timetable Observable
		this.timetable$ = this.state.getTimetableData(this.date).pipe(
			map(data => {
				// this.firstPaint = false;                   // TODO: ok to animate if Observable re-emits
				this.locations = (data.client.location || []).length;
				this.selectedIndex = 0;                       // start on the first-page
				// this.dbg('table: %j', data.client.schedule);
				return data;
			})
		)
	}

	// TODO: popup info about a Class
	showEvent(event: string) {
		this.dbg('event: %j', event);
	}

	swipe(idx: number, event: any) {
		this.firstPaint = false;                          // ok to animate
		this.selectedIndex = swipe(idx, this.locations, event);
	}

	suffix(idx: number) {
		return suffix(idx);
	}
}