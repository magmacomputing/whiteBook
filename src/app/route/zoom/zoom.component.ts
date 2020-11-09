import { Component, OnInit, OnDestroy } from '@angular/core';
import { Observable, BehaviorSubject, Subject, of } from 'rxjs';
import { map, switchMap, mergeMap, takeUntil, tap } from 'rxjs/operators';

import { fire } from '@dbase/fire/fire.library';
import { COLLECTION, FIELD, STORE, CLASS, COLOR } from '@dbase/data.define';
import * as  zoom from '@dbase/zoom.schema';
import type { Class, Sheet } from '@dbase/data.schema';
import { DataService } from '@dbase/data/data.service';
import { StateService } from '@dbase/state/state.service';
import { DialogService } from '@service/material/dialog.service';

import { Instant, fmtInstant } from '@library/instant.library';
import { setTimer } from '@library/observable.library';
import { asCurrency } from '@library/number.library';
import { isUndefined } from '@library/type.library';
import { getPath } from '@library/object.library';
import { memoize } from '@library/utility.library';
import { dbg } from '@library/logger.library';

@Component({
	selector: 'wb-zoom',
	templateUrl: './zoom.component.html',
	styleUrls: ['./zoom.component.scss'],
})
export class ZoomComponent implements OnInit, OnDestroy {
	#dbg = dbg(this, 'ZoomComponent');
	public date!: Instant;															// the date of the Meeting to display
	public offset!: number;															// the number of days before today, to control UI date-spiiner
	private dateChange = false;													// used to set the selectedIndex

	public firstPaint = true;                           // indicate first-paint
	public selectedIndex: number = 0;                   // used by UI to swipe between <tabs>

	private stop$ = new Subject();											// notify Subscriptions to complete
	private meetings: zoom.Meeting[] = [];
	private meetingDate = new BehaviorSubject<Instant>(new Instant());
	public meetings$!: Observable<zoom.Meeting[]>;				// the date's Meetings

	private color!: Record<CLASS, Class>;
	private colorCache!: (white: zoom.White | undefined) => COLOR

	constructor(private data: DataService, private state: StateService, public dialog: DialogService) {
		setTimer(this.stop$)
			.subscribe(() => this.setDate(0));							// watch for midnight, then update UI to new date

		this.getMeetings();																// wire-up the Meetings Observable
		this.setDate(0);
		this.getColor();
	}

	private async getColor() {
		this.color = await this.data.getStore<Class>(STORE.class)
			.then(store => store.groupBy(true, FIELD.key))
		this.colorCache = memoize(this.setColor.bind(this));
	}

	ngOnInit() { }

	ngOnDestroy() {
		this.stop$.next(true);
		this.stop$.unsubscribe();
	}

	// onSwipe(idx: number, len: number, event: Event) {
	// 	alert(JSON.stringify(event.target));
	// 	this.dbg(event);
	// 	this.firstPaint = false;                          // ok to animate
	// 	this.selectedIndex = swipe(idx, len, event);
	// }

	/**
	 * Call this onInit, whenever the Admin changes the UI-date, and at midnight.  
	 * dir:	if -1,	show previous day  
	 * 			if  1,	show next day  
	 * 			if  0,	show today
	 */
	setDate(dir: -1 | 0 | 1) {
		this.offset = dir;
		this.date = dir === 0
			? new Instant().startOf('day')
			: new Instant(this.date).add(dir, 'days')

		this.meetingDate.next(this.date);									// give the date to the Observable
	}

	/**
	 * watch for changes to this.date,  
	 * then switch to get the meeting.started Events for this.date to determine Zoom uuid's,  
	 * then merge all documents (started/ended/joined/left) that relate to those uuid's,  
	 * then map everything into an IMeeting[] format for the UI to present
	 */
	private getMeetings() {
		return this.meetings$ = this.meetingDate					// wait on the date to change
			.pipe(
				takeUntil(this.stop$),												// teardown Observables
				tap(_ => this.meetings = []),									// reset the assembled details
				tap(_ => this.dateChange = true),							// move the selectedIndex to latest meeting

				switchMap(inst =>															// get all meeting.started events for this.date
					this.data.getLive<zoom.Event<zoom.Started>>(COLLECTION.zoom, {
						where: [
							fire.addWhere(FIELD.type, zoom.EVENT.started),
							fire.addWhere('track.date', inst.format(Instant.FORMAT.yearMonthDay)),
							fire.addWhere('hook', 0),
						]
					})
				),

				mergeMap(track => {														// merge all documents per meeting.started event
					return this.data.getLive<zoom.Event<zoom.Started | zoom.Ended | zoom.Joined | zoom.Left>>(COLLECTION.zoom, {
						where: [
							fire.addWhere('body.payload.object.uuid', track.map(started => started.body.payload.object.uuid), 'in'),
							fire.addWhere('hook', 0),
						],
						orderBy: fire.addOrder(FIELD.stamp),						// order by timestamp
					})
				}
				),

				map(track => {
					(track as zoom.Event<zoom.Started>[])								// look for Meeting.Started
						.filter(doc => getPath(doc, zoom.EVENT.type) === zoom.EVENT.started)
						.forEach(doc => {
							const { id: meeting_id, start_time, uuid, ...rest } = doc.body.payload.object;
							const label = fmtInstant(Instant.FORMAT.HHMI, start_time);
							const color = this.colorCache(doc.white);
							const idx = this.meetings.findIndex(meeting => meeting.uuid === uuid);

							if (idx === -1) {
								this.meetings.push({									// a new meeting started
									uuid, meeting_id, participants: [], ...rest,
									start: {
										[FIELD.id]: doc[FIELD.id], [FIELD.stamp]: doc[FIELD.stamp],
										white: doc.white, start_time, label, color
									},
								})

								if (!this.dateChange)									// flag date change if new meeting detected on current day
									this.dateChange = this.date.format(Instant.FORMAT.yearMonthDay) === new Instant().format(Instant.FORMAT.yearMonthDay);
							} else {																// change to existing meeting
								this.meetings[idx].start = { ...this.meetings[idx].start, white: doc.white, color };
							}
						});

					(track as zoom.Event<zoom.Ended>[])									// look for Meeting.Ended
						.filter(doc => getPath(doc, zoom.EVENT.type) === zoom.EVENT.ended)
						.forEach(doc => {
							const { uuid, end_time, ...rest } = doc.body.payload.object;
							const label = fmtInstant(Instant.FORMAT.HHMI, end_time);
							const idx = this.meetings.findIndex(meeting => meeting.uuid === uuid);

							if (idx !== -1)
								this.meetings[idx].end = { [FIELD.id]: doc[FIELD.id], [FIELD.stamp]: doc[FIELD.stamp], end_time, label };
						});

					(track as zoom.Event<zoom.Joined>[])									// add Participants.Joined
						.filter(doc => getPath(doc, zoom.EVENT.type) === zoom.EVENT.joined)
						.forEach(doc => {
							const { id: participant_id, user_id, user_name, join_time } = doc.body.payload.object.participant;
							const { class: event, price, credit, status = {} as zoom.White["status"] } = doc.white || {};
							const weekTrack = (status?._week || '0.0.0').split('.').map(Number);
							const label = fmtInstant(Instant.FORMAT.HHMI, join_time);
							const idx = this.meetings.findIndex(meeting => meeting.uuid === doc.body.payload.object.uuid);

							const fgcolor = { alias: this.color[event as CLASS]?.color };
							const bgcolor: zoom.Meeting["participants"][0]["join"]["bgcolor"] = {
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
								const leave = this.meetings[idx].participants[pdx]?.leave;	// in case Join-update where Member already Left

								this.meetings[idx].participants[pdx === -1 ? this.meetings[idx].participants.length : pdx] = {
									participant_id, user_id, user_name, leave,
									join: { [FIELD.id]: doc[FIELD.id], [FIELD.stamp]: doc[FIELD.stamp], white: doc.white!, join_time, label, price, credit, fgcolor, bgcolor },
								}
							}
						});

					(track as zoom.Event<zoom.Left>[])										// add Participants.Left
						.filter(doc => getPath(doc, zoom.EVENT.type) === zoom.EVENT.left)
						.forEach(doc => {
							const { id: participant_id, user_id, user_name, leave_time } = doc.body.payload.object.participant;
							const label = fmtInstant(Instant.FORMAT.HHMI, leave_time);
							const idx = this.meetings.findIndex(meeting => meeting.uuid === doc.body.payload.object.uuid);

							if (idx !== -1) {
								const pdx = this.meetings[idx].participants.findIndex(party => party.user_id === user_id);
								if (pdx === -1) {										// Leave without a corresponding Join, so create dummy Join
									this.meetings[idx].participants.push({
										participant_id, user_id, user_name,
										join: { [FIELD.id]: '', [FIELD.stamp]: -1, white: {}, join_time: leave_time, label: '', },
										leave: { [FIELD.id]: doc[FIELD.id], [FIELD.stamp]: doc[FIELD.stamp], leave_time, label },
									})
								}
								else this.meetings[idx].participants[pdx].leave = { [FIELD.id]: doc[FIELD.id], [FIELD.stamp]: doc[FIELD.stamp], leave_time, label }
							}
						});

					if (this.dateChange) {
						this.dateChange = false;
						this.selectedIndex = this.meetings.length - 1;
					}
					return this.meetings;
				}),
			)
	}

	/**
	 * Popup a attend-this-week summary.  
	 * Note this shows only attends recorded through Zoom (not direct to WhiteBook)
	 */
	async showWeek(white?: zoom.White) {
		if (isUndefined(white))
			return;
		if (!white.alias)
			return;
		if (!white.status?.trackDaysThisWeek)
			return;

		const where = [
			fire.addWhere(FIELD.type, zoom.EVENT.joined),
			fire.addWhere('white.alias', white.alias),
			fire.addWhere('track.week', this.date.format(Instant.FORMAT.yearWeek)),
		]
		const [join, sheet] = await Promise.all([
			this.data.getLive<zoom.Event<zoom.Joined>>(COLLECTION.zoom, { where }),
			this.state.getSingle<Sheet>(STORE.sheet, fire.addWhere(FIELD.uid, white.alias))
		])

		const image = sheet.picture;
		const title = white.alias;
		const subtitle = `Attends this week for <span style="font-weight:bold;">${sheet.userName}</span>`;
		const actions = ['Close'];
		const attends: { date: number, attend?: string }[] = [];

		const obs$ = join.pipe(
			takeUntil(this.stop$),												// teardown Subject

			map(docs => docs.filter(doc => !isUndefined(doc.white?.price))),
			map(docs => docs.map(doc => {
				const { class: event, price } = doc.white || {};
				const color = this.colorCache(doc.white);
				const { join_time } = doc.body.payload.object.participant || [];
				const join = new Instant(join_time);

				const fmt = `
				<tr>
				<td>${join.format('ddd')}</td>
				<td>${join.format('HH:MM')} </td>
				<td style="color:${color};font-weight:bold;" > ${event} </td>
				<td align = "right" > ${asCurrency(price!)} </td>
				</tr>`;
				return attends.push({ date: doc[FIELD.stamp], attend: fmt });
			})
			),
			switchMap(_ => of(attends
				.orderBy(FIELD.date)
				.map(list => list.attend)
			)),
		)

		this.dialog.open({ image, title, subtitle, actions, observe: obs$ });
	}

	setColor(white?: zoom.White) {
		return (white?.class && this.color[white.class as CLASS].color) || COLOR.black;
	}
}
