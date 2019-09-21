import { Component, OnDestroy } from '@angular/core';
import { Observable, Subscription, of } from 'rxjs';
import { map, delay } from 'rxjs/operators';

import { AttendService } from '@service/member/attend.service';
import { DialogService } from '@service/material/dialog.service';

import { ITimetableState } from '@dbase/state/state.define';
import { StateService } from '@dbase/state/state.service';
import { FIELD } from '@dbase/data/data.define';
import { IComment, IReact } from '@dbase/data/data.schema';
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
export class AttendComponent implements OnDestroy {
	private dbg = dbg(this);
	public date!: Instant;															// the date for the Schedule to display
	public offset!: number;															// the number of days before today 
	// public forum!: PForum;

	public selectedIndex: number = 0;                   // used by UI to swipe between <tabs>
	public locations: number = 0;                       // used by UI to swipe between <tabs>
	public timetable$!: Observable<ITimetableState>;		// the date's Schedule
	// public forum$!: Observable<IForumState>;						// the date's Comments / Reacts

	public firstPaint = true;                           // indicate first-paint

	private timerSubscription!: Subscription;						// watch for midnight, then reset this.date
	private forumSubscription!: Subscription;						// watch Comments / Reacts

	constructor(private readonly attend: AttendService, public readonly state: StateService,
		public readonly data: DataService, private dialog: DialogService) { this.setDate(0); }

	ngOnDestroy() {
		this.timerSubscription && this.timerSubscription.unsubscribe();
		// this.forumSubscription && this.forumSubscription.unsubscribe()
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
			content.push(`Start: ${dow} @ ${new Instant(item.start).format(DATE_FMT.hhmi)}`)
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

		this.date = this.offset > 6			// only allow up-to 6 days in the past
			? today												// else reset to today
			: offset

		this.getSchedule();							// get day's Schedule

		// this.getForum();								// get day's Comments / Reacts

		if (!this.timerSubscription)
			this.setTimer();							// set a Schedule-view timeout
	}

	private getSchedule() {
		this.timetable$ = this.state.getScheduleData(this.date).pipe(
			map(data => {
				this.locations = (data.client.location || []).length;
				this.selectedIndex = 0;                       // start on the first-page
				this.dbg('forum: %j', data["forum"]);
				return data;
			})
		)
	}

	// Subscribe to this.date's Comments / Reacts
	// private getForum() {
	// 	const query: IQuery = {
	// 		where: addWhere('track.date', this.date.format(DATE_FMT.yearMonthDay)),
	// 		orderBy: addOrder(FIELD.stamp),
	// 	}

	// 	this.dbg('getForum: %j', query);
	// 	this.forum$ = this.data.getFire<IComment | IReact>(COLLECTION.forum, query);
	// 	this.forumSubscription && this.forumSubscription.unsubscribe()
	// 	this.forumSubscription = this.forum$.subscribe(
	// 		data => this.dbg('forum: %j', data),
	// 	)
	// }

	/** If the Member is still sitting on this page at midnight, move this.date to next day */
	private setTimer() {
		const defer = new Instant().add(1, 'day').startOf('day');
		this.dbg('timeOut: %s', defer.format('ddd, yyyy-mmm-dd HH:MI'));

		this.timerSubscription && this.timerSubscription.unsubscribe();
		this.timerSubscription = of(0)										// a single-emit Observable
			.pipe(delay(defer.toDate()))
			.subscribe(() => {
				this.timerSubscription.unsubscribe();					// stop watching for midnight
				this.setDate(0);															// onNext, show new day's timetable
			})
	}
}