import { Component, OnInit, OnDestroy } from '@angular/core';

import { Observable, Subscription, of, combineLatest } from 'rxjs';
import { delay, map, switchMap, tap, mergeMap, flatMap } from 'rxjs/operators';

import { addWhere, addOrder } from '@dbase/fire/fire.library';
import { COLLECTION, FIELD, Zoom, STORE, CLASS } from '@dbase/data/data.define';
import { DataService } from '@dbase/data/data.service';
import { IMeeting, IZoom, TStarted, TEnded, TJoined, TLeft, IClass } from '@dbase/data/data.schema';

import { Instant, fmtDate } from '@library/instant.library';
import { isUndefined } from '@library/type.library';
import { getPath } from '@library/object.library';
import { suffix } from '@library/number.library';
import { swipe } from '@library/html.library';
import { dbg } from '@library/logger.library';

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
	private timerSubscription!: Subscription;						// watch for midnight, then reset this.date

	private color!: Record<CLASS, string>;

	constructor(private data: DataService) {
		this.setDate(0);
		this.getColor();
	}

	private async getColor() {
		this.color = await this.data.getStore<IClass>(STORE.class)
			.then(store => store.reduce((acc, itm) => { acc[itm[FIELD.key]] = itm.color; return acc; }, {} as Record<CLASS, string>))
	}

	ngOnInit() { }

	ngOnDestroy() {
		this.timerSubscription?.unsubscribe();						// reset the end-of-day Subscription
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
		const today = new Instant();
		const offset = dir === 0
			? today
			: new Instant(this.date).add(dir, 'days')
		this.offset = today.diff('days', offset);

		this.date = this.offset > 6 && false
			// only allow up-to 6 days in the past
			? today																					// else reset to today
			: offset

		this.getMeetings();																// get day's Schedule

		if (!this.timerSubscription)											// if not already listening...
			this.setTimer();																// set a Schedule-view timeout
	}

	/** If the Member is still sitting on this page at midnight, move this.date to next day */
	private setTimer() {
		const midnight = new Instant().add(1, 'day').startOf('day');
		this.dbg('timeOut: %s', midnight.format(Instant.FORMAT.dayTime));

		this.timerSubscription?.unsubscribe();
		this.timerSubscription = of(0)										// a single-emit Observable
			.pipe(delay(midnight.toDate()))									// emit at midnight
			.subscribe(() => {
				this.timerSubscription?.unsubscribe();				// stop watching for midnight
				this.setDate(0);															// onNext, show new day's timetable
			})
	}

	public log(meeting: IMeeting) {
		console.log(meeting);
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
		const meeting: IMeeting[] = [];										// whenever the Date changes, reset the Meeting Observable
		this.selectedIndex = 0;														// reset to the first Meeting <tab>

		this.meetings$ = this.data.getLive<IZoom<TStarted>>(COLLECTION.zoom, { where })
			.pipe(
				// tap(track => console.log('tap: ', track)),

				mergeMap(track => {
					track																								// First, get Meeting.Started
						.sort((a, b) => a[FIELD.stamp] - b[FIELD.stamp])
						.forEach(doc => {
							const { id: meeting_id, start_time, uuid, ...rest } = doc.body.payload.object;
							const label = fmtDate(Instant.FORMAT.HHMI, doc.stamp);
							const color = doc.white?.class && this.color[doc.white.class as CLASS] || 'black';
							const idx = meeting.findIndex(mtg => mtg.uuid === uuid);

							if (idx === -1) {
								meeting.push({
									uuid, meeting_id, participants: [], ...rest,
									start: {
										[FIELD.id]: doc[FIELD.id], [FIELD.stamp]: doc[FIELD.stamp],
										white: doc.white, start_time, label, color
									},
								})
							}
						});

					return this.data.getLive<IZoom<TStarted | TEnded | TJoined | TLeft>>(COLLECTION.zoom, {
						where: addWhere('body.payload.object.uuid', meeting.map(mtg => mtg.uuid), 'in'),
					})
				}),

				// tap(track => console.log('map: ', track)),

				map(track => {
					(track as IZoom<TEnded>[])													// look for Meeting.Ended
						.filter(doc => getPath(doc, Zoom.EVENT.type) === Zoom.EVENT.ended)
						.forEach(doc => {
							const { uuid, end_time, ...rest } = doc.body.payload.object;
							const label = fmtDate(Instant.FORMAT.HHMI, doc.stamp);
							const idx = meeting.findIndex(mtg => mtg.uuid === uuid);

							if (idx !== -1)
								meeting[idx].end = { [FIELD.id]: doc[FIELD.id], [FIELD.stamp]: doc[FIELD.stamp], end_time, label };
						});

					(track as IZoom<TJoined>[])													// add Participants.Joined
						.filter(doc => getPath(doc, Zoom.EVENT.type) === Zoom.EVENT.joined)
						.sort((a, b) => a[FIELD.stamp] - b[FIELD.stamp])
						.forEach(doc => {
							const { id: participant_id, user_id, user_name, join_time } = doc.body.payload.object.participant;
							const { price } = doc.white?.checkIn || {};
							const { bank = 0, amt = 0, spend = 0, pre = 0 } = doc.white?.checkIn?.nextAttend || {};
							const weekTrack = (doc.white?.status?._week || '0.0.0').split('.').map(Number);
							const label = fmtDate(Instant.FORMAT.HHMI, doc.stamp);
							const credit = doc.white?.paid ? bank + amt - spend + pre - price! : undefined;
							const idx = meeting.findIndex(mtg => mtg.uuid === doc.body.payload.object.uuid);

							const bgcolor = {
								price: isUndefined(price) || price > 0 ? '#ffffff' : '#d9ead3',
								credit: isUndefined(credit) || credit > 20 ? '#ffffff' : credit <= 10 ? '#e6b8af' : '#fff2cc',
								bonus: (weekTrack[2] <= 4 || weekTrack[1] === 7) ? '#ffffff' : '#fff2cc',
							}

							if (idx !== -1) {
								console.log(JSON.stringify(doc.body.payload.object.participant));
								const pdx = meeting[idx].participants.findIndex(party => party.user_id === user_id);

								meeting[idx].participants[pdx === -1 ? meeting[idx].participants.length : pdx] = {
									participant_id, user_id, user_name,
									join: { [FIELD.id]: doc[FIELD.id], [FIELD.stamp]: doc[FIELD.stamp], white: doc.white!, join_time, label, price, credit, bgcolor },
								};
							}
						});

					(track as IZoom<TLeft>[])														// add Participants.Left
						.filter(doc => getPath(doc, Zoom.EVENT.type) === Zoom.EVENT.left)
						.forEach(doc => {
							const { id: participant_id, user_id, user_name, leave_time } = doc.body.payload.object.participant;
							const label = fmtDate(Instant.FORMAT.HHMI, doc.stamp);
							const idx = meeting.findIndex(mtg => mtg.uuid === doc.body.payload.object.uuid);

							if (idx !== -1) {
								const pdx = meeting[idx].participants.findIndex(party => party.user_id === user_id);
								if (pdx !== -1)
									meeting[idx].participants[pdx].leave = { [FIELD.id]: doc[FIELD.id], [FIELD.stamp]: doc[FIELD.stamp], leave_time, label }
							}
						});

					return meeting;
				}),
			)
	}
}
