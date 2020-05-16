import { Component, OnInit, OnDestroy } from '@angular/core';

import { Observable, BehaviorSubject, Subject } from 'rxjs';
import { map, switchMap, mergeMap, takeUntil, delay, tap } from 'rxjs/operators';

import { addWhere } from '@dbase/fire/fire.library';
import { COLLECTION, FIELD, Zoom, STORE, CLASS, COLOR } from '@dbase/data/data.define';
import { DataService } from '@dbase/data/data.service';
import { IMeeting, IZoom, TStarted, TEnded, TJoined, TLeft, IClass, IWhite } from '@dbase/data/data.schema';

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

	private stop$ = new Subject();											// notify Subscriptions to complete
	private meetings: IMeeting[] = [];
	private meetingDate = new BehaviorSubject<Instant>(new Instant());
	public meetings$!: Observable<IMeeting[]>;					// the date's Meetings

	private color!: Record<CLASS, IClass>;

	constructor(private data: DataService) {
		this.setTimer();																	// subscribe to midnight
		this.getMeetings();																// wire-up the Meetings Observable
		this.setDate(0);
		this.getColor();
	}

	private async getColor() {
		this.color = await this.data.getStore<IClass>(STORE.class)
			.then(store => store.groupBy<CLASS>(FIELD.key))
	}

	ngOnInit() { }

	ngOnDestroy() {
		this.stop$.next(true);
		this.stop$.unsubscribe();
	}

	onSwipe(idx: number, len: number, event: Event) {
		alert(JSON.stringify(event.target));
		console.log(event);
		this.firstPaint = false;                          // ok to animate
		this.selectedIndex = swipe(idx, len, event);
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
		const today = new Instant().startOf('day');
		const offset = dir === 0
			? today
			: new Instant(this.date).add(dir, 'days')

		this.offset = today.diff('days', offset);
		this.date = this.offset > 6 && false							// only allow up-to 6 days in the past
			? today																					// else reset to today
			: offset
		// console.log('timer: ', this.date.format(Instant.FORMAT.dayTime));
		this.meetingDate.next(this.date);									// give the date to the Observable
	}

	/** If the Member is still sitting on this page at midnight, move this.date to next day */
	private setTimer() {
		// const mid = new BehaviorSubject<Instant>(new Instant());
		// let midnight = new Instant().add(10, 'seconds');

		// mid
		// 	.pipe(
		// 		takeUntil(this.stop$),
		// 		delay(midnight.toDate()),
		// 	)
		// 	.subscribe(
		// 		(now) => {
		// 			this.setDate(0);														// move the UI to new day
		// 			mid.next(now);															// restart the timer
		// 			midnight = new Instant().add(1, 'day').startOf('day');
		// 			this.dbg('timer: %s', midnight.format(Instant.FORMAT.dayTime))
		// 		}
		// 	)
	}

	/**
	 * first get the meeting.started  Events for this.date  to determined uuid's.  
	 * then collect all documents that relate to those uuid's,  
	 * then assemble details into an array of IMeeting
	 */
	private getMeetings() {
		return this.meetings$ = this.meetingDate					// wait on the Subject
			.pipe(
				takeUntil(this.stop$),
				switchMap(inst => {
					const where = [
						addWhere('track.date', inst.format(Instant.FORMAT.yearMonthDay)),
						addWhere(FIELD.type, Zoom.EVENT.started),
					]

					this.meetings = [];													// whenever the Date changes, reset the Meeting Observable
					this.selectedIndex = 0;											// reset to the first Meeting <tab>
					return this.data.getLive<IZoom<TStarted>>(COLLECTION.zoom, { where });
				}),
				mergeMap(track => {
					track																				// First, get Meeting.Started
						.sort((a, b) => a[FIELD.stamp] - b[FIELD.stamp])
						.forEach(doc => {
							const { id: meeting_id, start_time, uuid, ...rest } = doc.body.payload.object;
							const label = fmtDate(Instant.FORMAT.HHMI, doc.stamp);
							const color = doc.white?.class && this.color[doc.white.class as CLASS].color || COLOR.black;
							const idx = this.meetings.findIndex(meeting => meeting.uuid === uuid);

							if (idx === -1) {
								this.meetings.push({
									uuid, meeting_id, participants: [], ...rest,
									start: {
										[FIELD.id]: doc[FIELD.id], [FIELD.stamp]: doc[FIELD.stamp],
										white: doc.white, start_time, label, color
									},
								})

							}
						});

					return this.data.getLive<IZoom<TStarted | TEnded | TJoined | TLeft>>(COLLECTION.zoom, {
						where: addWhere('body.payload.object.uuid', this.meetings.map(meeting => meeting.uuid), 'in'),
					})
				}),

				map(track => {
					(track as IZoom<TEnded>[])									// look for Meeting.Ended
						.filter(doc => getPath(doc, Zoom.EVENT.type) === Zoom.EVENT.ended)
						.forEach(doc => {
							const { uuid, end_time, ...rest } = doc.body.payload.object;
							const label = fmtDate(Instant.FORMAT.HHMI, doc.stamp);
							const idx = this.meetings.findIndex(meeting => meeting.uuid === uuid);

							if (idx !== -1)
								this.meetings[idx].end = { [FIELD.id]: doc[FIELD.id], [FIELD.stamp]: doc[FIELD.stamp], end_time, label };
						});

					(track as IZoom<TJoined>[])									// add Participants.Joined
						.filter(doc => getPath(doc, Zoom.EVENT.type) === Zoom.EVENT.joined)
						.sort((a, b) => a[FIELD.stamp] - b[FIELD.stamp])
						.forEach(doc => {
							const { id: participant_id, user_id, user_name, join_time } = doc.body.payload.object.participant;
							const { class: event, price, credit, status = {} as IWhite["status"] } = doc.white || {};
							const weekTrack = (status?._week || '0.0.0').split('.').map(Number);
							const label = fmtDate(Instant.FORMAT.HHMI, doc.stamp);
							const idx = this.meetings.findIndex(meeting => meeting.uuid === doc.body.payload.object.uuid);

							const fgcolor = { alias: this.color[event as CLASS]?.color };
							const bgcolor: IMeeting["participants"][0]["join"]["bgcolor"] = {
								price: isUndefined(price) || price > 0 ? COLOR.black : COLOR.green,
								credit: isUndefined(credit) || credit > 20 ? COLOR.black : credit < 10 ? COLOR.red : COLOR.yellow,
								bonus: (weekTrack[2] <= 4 || weekTrack[1] === 7) ? COLOR.black : COLOR.yellow,
							}
							if (bgcolor?.price !== COLOR.black && status?.eventNote)
								bgcolor.priceTip = status.eventNote.startsWith('Bonus: ')
									? status.eventNote.split(':')[1].trim()
									: status?.eventNote;
							if (bgcolor.credit !== COLOR.black) {
								bgcolor.creditTip = (credit || 0) <= 0 ? 'TopUp Due' : (credit || 0) < 10 ? 'Low Credit' : 'Credit Alert'
							}
							if (status?.bonus)
								bgcolor.bonusTip = status.bonus.indexOf('>')
									? status.bonus.split('>')[1].split('<')[0]
									: status.bonus

							if (idx !== -1) {
								const pdx = this.meetings[idx].participants.findIndex(party => party.user_id === user_id);

								this.meetings[idx].participants[pdx === -1 ? this.meetings[idx].participants.length : pdx] = {
									participant_id, user_id, user_name,
									join: { [FIELD.id]: doc[FIELD.id], [FIELD.stamp]: doc[FIELD.stamp], white: doc.white!, join_time, label, price, credit, fgcolor, bgcolor },
								}
							}
						});

					(track as IZoom<TLeft>[])										// add Participants.Left
						.filter(doc => getPath(doc, Zoom.EVENT.type) === Zoom.EVENT.left)
						.forEach(doc => {
							const { id: participant_id, user_id, user_name, leave_time } = doc.body.payload.object.participant;
							const label = fmtDate(Instant.FORMAT.HHMI, doc.stamp);
							const idx = this.meetings.findIndex(meeting => meeting.uuid === doc.body.payload.object.uuid);

							if (idx !== -1) {
								const pdx = this.meetings[idx].participants.findIndex(party => party.user_id === user_id);
								if (pdx === -1) {										// Leave without a corresponding Join
									this.meetings[idx].participants.push({
										participant_id, user_id, user_name,
										join: { [FIELD.id]: '', [FIELD.stamp]: -1, white: {}, join_time: leave_time, label: '', },
										leave: { [FIELD.id]: doc[FIELD.id], [FIELD.stamp]: doc[FIELD.stamp], leave_time, label },
									})
								}
								else this.meetings[idx].participants[pdx].leave = { [FIELD.id]: doc[FIELD.id], [FIELD.stamp]: doc[FIELD.stamp], leave_time, label }
							}
						});

					this.selectedIndex = this.meetings.length - 1;
					return this.meetings;
				}),
			)
	}
}
