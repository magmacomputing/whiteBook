import { Component, OnDestroy } from '@angular/core';
import { Observable, Subscription, of } from 'rxjs';
import { map, delay } from 'rxjs/operators';

import { ForumService } from '@service/forum/forum.service';
import { AttendService } from '@service/member/attend.service';
import { DialogService } from '@service/material/dialog.service';

import { ITimetableState } from '@dbase/state/state.define';
import { StateService } from '@dbase/state/state.service';
import { FIELD, REACT } from '@dbase/data/data.define';
import { ISchedule, IForumBase } from '@dbase/data/data.schema';
import { DataService } from '@dbase/data/data.service';

import { isUndefined, TString } from '@library/type.library';
import { Instant } from '@library/instant.library';
import { suffix } from '@library/number.library';
import { swipe } from '@library/html.library';
import { dbg } from '@library/logger.library';

@Component({
	selector: 'wb-attend',
	templateUrl: './attend.component.html',
	styleUrls: ['./attend.component.scss'],
})
export class AttendComponent implements OnDestroy {
	private dbg = dbg(this);
	public date!: Instant;															// the date for the Schedule to display
	public offset!: number;															// the number of days before today 
	public firstPaint = true;                           // indicate first-paint

	public selectedIndex: number = 0;                   // used by UI to swipe between <tabs>
	public locations: number = 0;                       // used by UI to swipe between <tabs>
	public timetable$!: Observable<ITimetableState>;		// the date's Schedule
	private timerSubscription!: Subscription;						// watch for midnight, then reset this.date

	constructor(private readonly attend: AttendService, public readonly state: StateService,
		public readonly data: DataService, private dialog: DialogService, private forum: ForumService) { this.setDate(0); }

	ngOnDestroy() {
		this.timerSubscription && this.timerSubscription.unsubscribe();
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
		const image = item.image;
		const actions = ['Close'];

		let content: string[] = [];
		if (!isUndefined(item.amount))
			content.push(`Cost: $${item.amount.toFixed(2)}`);
		if (item.start)
			content.push(`Start: ${dow} @ ${new Instant(item.start).format(Instant.FORMAT.hhmi)}`)
		if (span)
			content.push(`Duration: ${span.duration} minutes`);
		if (item.count)
			content.push(`Attended: ${item.count} time${item.count > 1 ? 's' : ''}`);
		if (locn)
			content.push(`Location: ${locn.name}`);
		if (instr)
			content.push(`Instructor: ${instr.name}`);

		this.dialog.open({ content, title, subtitle, image, actions });
	}

	swipe(idx: number, event: any) {
		this.firstPaint = false;                          // ok to animate
		this.selectedIndex = swipe(idx, this.locations, event);
	}

	suffix(idx: number) {
		return suffix(idx);
	}

	/**
	 * Call this onInit, whenever the Member changes the UI-date, and at midnight.   
	 * It will allow a Member to check-in to a Class up-to 6 days in the past,  
	 * useful if they forgot to scan at the time.  
	 * dir:	if -1,	show previous day  
	 * 			if 1,		show next day  
	 * 			if 0,		show today
	 */
	setDate(dir: -1 | 0 | 1) {
		const today = new Instant();
		const offset = dir === 0
			? today
			: new Instant(this.date).add(dir, 'days')
		this.offset = today.diff('days', offset);

		this.date = this.offset > 6												// only allow up-to 6 days in the past
			? today																					// else reset to today
			: offset

		this.getSchedule();																// get day's Schedule

		if (!this.timerSubscription)
			this.setTimer();																// set a Schedule-view timeout
	}

	private getSchedule() {
		this.timetable$ = this.state.getScheduleData(this.date).pipe(
			map(data => {
				this.selectedIndex = 0;                       // start on the first-page
				return data;
			})
		)
	}

	/** If the Member is still sitting on this page at midnight, move this.date to next day */
	private setTimer() {
		const defer = new Instant().add(1, 'day').startOf('day');
		this.dbg('timeOut: %s', defer.format(Instant.FORMAT.dayTime));

		this.timerSubscription && this.timerSubscription.unsubscribe();
		this.timerSubscription = of(0)										// a single-emit Observable
			.pipe(delay(defer.toDate()))
			.subscribe(() => {
				this.timerSubscription.unsubscribe();					// stop watching for midnight
				this.setDate(0);															// onNext, show new day's timetable
			})
	}

	public getForum() {
		this.forum.getForum<IForumBase>()
			.then(forum => this.dbg('forum: %j', forum))
	}
	public setReact(item: ISchedule, react: REACT) {
		this.forum.setReact({ key: item[FIELD.id], track: { class: item[FIELD.key] }, react })
			.then(_ => this.getForum())
	}
	public setComment(item: ISchedule, comment: TString) {
		this.forum.setComment({ key: item[FIELD.id], track: { class: item[FIELD.key] }, comment })
			.then(_ => this.getForum())
	}
}