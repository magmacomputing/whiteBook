import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { DialogService } from '@service/material/dialog.service';
import { AttendService } from '@service/member/attend.service';

import { ITimetableState } from '@dbase/state/state.define';
import { StateService } from '@dbase/state/state.service';
import { FIELD, COLLECTION, STORE } from '@dbase/data/data.define';
import { IReact } from '@dbase/data/data.schema';
import { DataService } from '@dbase/data/data.service';

import { isUndefined } from '@lib/type.library';
import { Instant, DATE_FMT } from '@lib/date.library';
import { suffix } from '@lib/number.library';
import { swipe } from '@lib/html.library';
import { dbg } from '@lib/logger.library';

@Component({
	selector: 'wb-attend',
	templateUrl: './attend.component.html',
	styleUrls: ['./attend.component.scss'],
})
export class AttendComponent implements OnInit {
	private dbg = dbg(this);
	public date = new Instant().format(DATE_FMT.display);
	public offset = 0;
	public note!: string;

	public selectedIndex: number = 0;                   // used by UI to swipe between <tabs>
	public locations: number = 0;                       // used by UI to swipe between <tabs>
	public timetable$!: Observable<ITimetableState>;
	public firstPaint = true;                           // indicate first-paint

	constructor(private readonly attend: AttendService, public readonly state: StateService,
		public readonly data: DataService, private dialog: DialogService) { }

	ngOnInit() {                                        // wire-up the timetable Observable
		this.timetable$ = this.state.getScheduleData(this.date).pipe(
			map(data => {
				this.locations = (data.client.location || []).length;
				this.selectedIndex = 0;                       // start on the first-page
				return data;
			})
		)
	}

	// Build info to show in a Dialog
	showEvent(client: ITimetableState["client"], idx: number) {
		const item = client.schedule![idx];							// the Schedule item clicked
		const event = client.class!.find(row => row[FIELD.key] === item[FIELD.key]);
		const locn = client.location!.find(row => row[FIELD.key] === item.location);
		const instr = client.instructor!.find(row => row[FIELD.key] === item.instructor);
		const span = client.span!.find(row => row[FIELD.key] === event![FIELD.type]);
		const dow = Instant.WEEKDAY[item.day];
		// const bonus = client.bonus!.find(row => row[FIELD.key] === item.bonus);

		const title = item[FIELD.key];
		const subtitle = event && event.desc || '';
		const icon = item.icon;
		const actions = ['Close'];

		let content: string[] = [];
		if (!isUndefined(item.amount))
			content.push(`Cost: $${item.amount.toFixed(2)}`);
		if (item.start)
			content.push(`Start: ${dow} @ ${new Instant(item.start).format(DATE_FMT.hhmi)}`)
		if (span)
			content.push(`Duration: ${span.duration} minutes`);
		if (item.count)
			content.push(`Attended: ${item.count} time${item.count > 1 ? 's' : ''}`);
		if (locn)
			content.push(`Location: ${locn.name}`);
		if (instr)
			content.push(`Instructor: ${instr.name}`);

		this.dialog.open({ content, title, subtitle, icon, actions });
	}

	swipe(idx: number, event: any) {
		this.firstPaint = false;                          // ok to animate
		this.selectedIndex = swipe(idx, this.locations, event);
	}

	suffix(idx: number) {
		return suffix(idx);
	}

	/**
	 * I expect this will be called very infrequently.  
	 * It will allow a Member to check-in to a Class up-to 6 days in the past,  
	 * useful if they forgot to scan at the time.  
	 * dir:	if -1,	show previous day
	 * 			if 1,		show next day
	 * 			if 0,		show today
	 */
	setDate(dir: number) {
		const today = new Instant();
		const offset = dir === 0
			? today
			: new Instant(this.date).add(dir, 'days')
		this.offset = today.diff('days', offset);

		this.date = this.offset > 6
			? today.format(DATE_FMT.display)
			: offset.format(DATE_FMT.display)

		this.ngOnInit();
	}
}