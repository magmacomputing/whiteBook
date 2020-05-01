import { Component, OnInit, OnDestroy } from '@angular/core';

import { Observable, Subscription, of } from 'rxjs';
import { delay, map, switchMap } from 'rxjs/operators';

import { addWhere, addOrder } from '@dbase/fire/fire.library';
import { COLLECTION, FIELD, Zoom } from '@dbase/data/data.define';
import { DataService } from '@dbase/data/data.service';
import { IMeeting, IZoom, TStarted, TEnded, TJoined, TLeft } from '@dbase/data/data.schema';

import { Instant, fmtDate } from '@library/instant.library';
import { swipe } from '@library/html.library';
import { suffix } from '@library/number.library';
import { getPath } from '@library/object.library';
import { dbg } from '@library/logger.library';
import { type } from 'os';
import { asArray } from '@library/array.library';

@Component({
	selector: 'wb-zoom',
	templateUrl: './zoom.component.html',
	styleUrls: ['./zoom.component.scss'],
})
export class ZoomComponent implements OnInit, OnDestroy {
	private dbg = dbg(this);
	public date!: Instant;															// the date for the Schedule to display
	public offset!: number;															// the number of days before today 

	public firstPaint = true;                           // indicate first-paint
	public selectedIndex: number = 0;                   // used by UI to swipe between <tabs>
	public meetings = 0;

	public meetings$!: Observable<IMeeting[]>;					// the date's Meetings
	private meetingSubscription!: Subscription;					// the Meeting's Observable	
	private timerSubscription!: Subscription;						// watch for midnight, then reset this.date

	constructor(private data: DataService) { this.setDate(0); }

	ngOnInit(): void { }

	ngOnDestroy() {
		this.timerSubscription && this.timerSubscription.unsubscribe();
		this.meetingSubscription?.unsubscribe();
	}

	swipe(idx: number, event: any) {
		this.firstPaint = false;                          // ok to animate
		this.selectedIndex = swipe(idx, this.meetings, event);
	}

	suffix(idx: number) {
		return suffix(idx);
	}

	/**
   * Call this onInit, whenever the Admin changes the UI-date, and at midnight.  
   * dir:	if -1,	show previous day  
   * 			if 1,		show next day  
   * 			if 0,		show today
   */
	setDate(dir: -1 | 0 | 1) {
		console.log('dir: ', dir);
		const today = new Instant();
		const offset = dir === 0
			? today
			: new Instant(this.date).add(dir, 'days')
		this.offset = today.diff('days', offset);

		this.date = this.offset > 6												// only allow up-to 6 days in the past
			? today																					// else reset to today
			: offset

		this.getMeetings();																// get day's Schedule

		if (!this.timerSubscription)
			this.setTimer();																// set a Schedule-view timeout
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

	/**
	 * first get the meeting.started  Events for this.date  to determined uuid's.  
	 * then collect all documents that relate to those uuid's,  
	 * then assemble details into an array of IMeeting
	 */
	private getMeetings() {
		const where = [
			addWhere('track.date', this.date.format(Instant.FORMAT.yearMonthDay)),
			addWhere(FIELD.type, Zoom.EVENT.started),
		]
		this.meetings$ = this.data.getLive<IZoom<TStarted>>(COLLECTION.zoom, { where })
			.pipe(
				switchMap(start => {
					const uuids: Set<string> = new Set(start.map(doc => doc.body.payload.object.uuid));
					return this.data.getLive<IZoom<TStarted | TEnded | TJoined | TLeft>>(COLLECTION.zoom, {
						where: addWhere('body.payload.object.uuid', asArray(uuids), 'in'),
						orderBy: addOrder(FIELD.stamp),
					})
				}),
				map(track => {
					this.selectedIndex = 0;
					const meeting: IMeeting[] = [];							// in reality, we are expecting only 1 Meeting per report

					// First, get Meeting.Start
					(track as IZoom<TStarted>[])
						.filter(doc => getPath(doc, Zoom.EVENT.type) === Zoom.EVENT.started)
						.forEach(doc => {
							const { id: meeting_id, start_time, ...rest } = doc.body.payload.object;
							const label = fmtDate(Instant.FORMAT.HHMI, doc.stamp)
							meeting.push({ start: { [FIELD.id]: doc[FIELD.id], [FIELD.stamp]: doc[FIELD.stamp], white: doc.white, start_time, label }, meeting_id, participants: [], ...rest })
						});

					// look for Meeting.End
					(track as IZoom<TEnded>[])
						.filter(doc => getPath(doc, Zoom.EVENT.type) === Zoom.EVENT.ended)
						.forEach(doc => {
							const { uuid, end_time, ...rest } = doc.body.payload.object;
							const label = fmtDate(Instant.FORMAT.HHMI, doc.stamp);
							const idx = meeting.findIndex(mtg => mtg.uuid === uuid);
							if (idx !== -1)
								meeting[idx].end = { [FIELD.id]: doc[FIELD.id], [FIELD.stamp]: doc[FIELD.stamp], end_time, label };
						});

					// add Participants.Join
					(track as IZoom<TJoined>[])
						.filter(doc => getPath(doc, Zoom.EVENT.type) === Zoom.EVENT.joined)
						.forEach(doc => {
							const { id: participant_id, user_id, user_name, join_time } = doc.body.payload.object.participant;
							const { price } = doc.white?.checkIn || {};
							const { bank = 0, amt = 0, spend = 0, pre = 0 } = doc.white?.checkIn?.nextAttend || {};
							const label = fmtDate(Instant.FORMAT.HHMI, doc.stamp);
							const credit = doc.white?.paid ? bank + amt - spend + pre - price! : undefined;
							const idx = meeting.findIndex(mtg => mtg.uuid === doc.body.payload.object.uuid);
							if (idx !== -1)
								meeting[idx].participants.push({ join: { [FIELD.id]: doc[FIELD.id], [FIELD.stamp]: doc[FIELD.stamp], white: doc.white!, join_time, label, price, credit }, participant_id, user_id, user_name, });
						});

					// add Participants.Leave
					(track as IZoom<TLeft>[])
						.filter(doc => getPath(doc, Zoom.EVENT.type) === Zoom.EVENT.left)
						.forEach(doc => {
							const { id: participant_id, user_id, user_name, leave_time } = doc.body.payload.object.participant;
							const label = fmtDate(Instant.FORMAT.HHMI, doc.stamp);
							const idx = meeting.findIndex(mtg => mtg.uuid === doc.body.payload.object.uuid);
							if (idx !== -1) {
								const part = meeting[idx].participants.findIndex(part => part.user_id === user_id);
								meeting[idx].participants[part].leave = { [FIELD.id]: doc[FIELD.id], [FIELD.stamp]: doc[FIELD.stamp], leave_time, label }
							}
						});
					return meeting;
				})
			)

		this.meetingSubscription?.unsubscribe();								// if already subscribed
		return this.meetingSubscription = this.meetings$.subscribe()
	}

}
