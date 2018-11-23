import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { ITimetableState } from '@dbase/state/state.define';
import { StateService } from '@dbase/state/state.service';
import { MemberService } from '@dbase/app/member.service';
import { DataService } from '@dbase/data/data.service';

import { FIELD, STORE } from '@dbase/data/data.define';
import { IPrice, IDefault, IClass } from '@dbase/data/data.schema';

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
	public firstPaint = true;                           // indicate first-paint

	constructor(private readonly member: MemberService, public readonly state: StateService, public readonly data: DataService) { }

	ngOnInit() {                                        // wire-up the timetable Observable
		this.timetable$ = this.state.getTimetableData(this.date).pipe(
			map(data => {
				const locs = (data.client.location || []).length;
				const sched = data.client.schedule || [];     // the schedule for today
				const event = data.client.class || [];        // the classes offered this.date
				const price = data.member.price || [];        // the prices per member's plan
				const costs: IPrice[] = [];                   // the price for a schedule item
				const icon = data.default[STORE.default].find(row => row[FIELD.type] === 'icon') || {} as IDefault;

				data.client.schedule = sched.map((time, idx) => {
					const span = event.find(itm => itm[FIELD.key] === time[FIELD.key]) ||{} as IClass;
					if (span[FIELD.type]) {
						const cost = price.find(itm => itm[FIELD.type] === span[FIELD.type]) || {} as IPrice;
						costs[idx] = cost;                        // stash the IPrice for each scheduled event
						time.price = time.price || cost.amount;		// add-on the member's price for each scheduled event
					}
					else time[FIELD.disable] = true;						// cannot determine the event

					if (!time[FIELD.icon])											// if no schedule-specific icon...
						time[FIELD.icon] = span.icon || icon[FIELD.key];				//	use class icon

					return time;
				})

				// this.firstPaint = false;                   // TODO: ok to animate if Observable re-emits
				this.locations = locs;
				this.selectedIndex = 0;                       // start on the first-page
				data.client.price = costs;

				this.dbg('plan: %j', data.member.plan);
				// this.dbg('calendar: %j', data.client);
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