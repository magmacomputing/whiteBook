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
import { DayTimer } from '@library/observable.library';
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
	#dateChange = false;																// used to set the selectedIndex

	public firstPaint = true;                           // indicate first-paint
	public selectedIndex: number = 0;                   // used by UI to swipe between <tabs>

	#stop$ = new Subject();															// notify Subscriptions to complete
	#timer!: DayTimer;
	#meetings: zoom.Meeting[] = [];
	#meetingDate = new BehaviorSubject<Instant>(new Instant());
	public meetings$!: Observable<zoom.Meeting[]>;				// the date's Meetings

	#color!: Record<CLASS, Class>;
	#colorCache!: (white: zoom.White | undefined) => COLOR

	constructor(private data: DataService, private state: StateService, public dialog: DialogService) {
		this.getMeetings();																// wire-up the Meetings Observable
		this.setDate(0);
		this.getColor();
	}

	private async getColor() {
		this.#color = await this.data.getStore<Class>(STORE.Class)
			.then(store => store.groupBy(true, FIELD.Key))
		this.#colorCache = memoize(this.setColor.bind(this));
	}

	ngOnInit() {
		this.#timer = new DayTimer(this.setDate.bind(this));// watch for midnight, then update UI to new date
	}

	ngOnDestroy() {
		this.#timer.stop();
	}

	/**
	 * Call this onInit, whenever the Admin changes the UI-date, and at midnight.  
	 * dir:	if -1,	show previous day  
	 * 			if  1,	show next day  
	 * 			if  0,	show today
	 */
	setDate(dir: -1 | 0 | 1 = 0) {
		this.offset = dir;
		this.date = dir === 0
			? new Instant().startOf('day')
			: new Instant(this.date).add(dir, 'days')

		this.#meetingDate.next(this.date);								// give the date to the Observable
	}

	/**
	 * watch for changes to this.date,  
	 * then switch to get the meeting.started Events for this.date to determine Zoom uuid's,  
	 * then merge all documents (started/ended/joined/left) that relate to those uuid's,  
	 * then map everything into an IMeeting[] format for the UI to present
	 */
	private getMeetings() {

		return this.meetings$ = this.#meetingDate					// wait on the date to change
			.pipe(
				takeUntil(this.#stop$),												// teardown Observables
				tap(_ => this.#meetings = []),								// reset the assembled details
				tap(_ => this.#dateChange = true),						// move the selectedIndex to latest meeting

				switchMap(inst =>															// get all meeting.started events for this.date
					this.data.listen<zoom.Event<zoom.Started>>(COLLECTION.Zoom, {
						where: [
							fire.addWhere(FIELD.Type, zoom.EVENT.Started),
							fire.addWhere('track.date', inst.format(Instant.FORMAT.yearMonthDay)),
							fire.addWhere('hook', 0),
						]
					})
				),

				mergeMap(track => {														// merge all documents per meeting.started event
					return this.data.listen<zoom.Event<zoom.Started | zoom.Ended | zoom.Joined | zoom.Left>>(COLLECTION.Zoom, {
						where: [
							fire.addWhere('body.payload.object.uuid', track.map(started => started.body.payload.object.uuid), 'in'),
							fire.addWhere('hook', 0),
						],
						orderBy: fire.addOrder(FIELD.Stamp),			// order by timestamp
					})
				}
				),

				map(track => {
					(track as zoom.Event<zoom.Started>[])				// look for Meeting.Started
						.filter(doc => getPath(doc, zoom.EVENT.Type) === zoom.EVENT.Started)
						.forEach(doc => {
							const { id: meeting_id, start_time, uuid, ...rest } = doc.body.payload.object;
							const label = fmtInstant(Instant.FORMAT.HHMI, start_time);
							const color = this.#colorCache(doc.white);
							const idx = this.#meetings.findIndex(meeting => meeting.uuid === uuid);

							if (idx === -1) {
								this.#meetings.push({									// a new meeting started
									uuid, meeting_id, participants: [], ...rest,
									start: {
										[FIELD.Id]: doc[FIELD.Id], [FIELD.Stamp]: doc[FIELD.Stamp],
										white: doc.white, start_time, label, color
									},
								})

								if (!this.#dateChange)									// flag date change if new meeting detected on current day
									this.#dateChange = this.date.format(Instant.FORMAT.yearMonthDay) === new Instant().format(Instant.FORMAT.yearMonthDay);
							} else {																// change to existing meeting
								this.#meetings[idx].start = { ...this.#meetings[idx].start, white: doc.white, color };
							}
						});

					(track as zoom.Event<zoom.Ended>[])									// look for Meeting.Ended
						.filter(doc => getPath(doc, zoom.EVENT.Type) === zoom.EVENT.Ended)
						.forEach(doc => {
							const { uuid, end_time, ...rest } = doc.body.payload.object;
							const label = fmtInstant(Instant.FORMAT.HHMI, end_time);
							const idx = this.#meetings.findIndex(meeting => meeting.uuid === uuid);

							if (idx !== -1)
								this.#meetings[idx].end = { [FIELD.Id]: doc[FIELD.Id], [FIELD.Stamp]: doc[FIELD.Stamp], end_time, label };
						});

					(track as zoom.Event<zoom.Joined>[])									// add Participants.Joined
						.filter(doc => getPath(doc, zoom.EVENT.Type) === zoom.EVENT.Joined)
						.forEach(doc => {
							const { id: participant_id, user_id, user_name, join_time } = doc.body.payload.object.participant;
							const { class: event, price, credit, status = {} as zoom.White["status"] } = doc.white || {};
							const weekTrack = (status?._week || '0.0.0').split('.').map(Number);
							const label = fmtInstant(Instant.FORMAT.HHMI, join_time);
							const idx = this.#meetings.findIndex(meeting => meeting.uuid === doc.body.payload.object.uuid);

							const fgcolor = { alias: this.#color[event as CLASS]?.color };
							const bgcolor: zoom.Meeting["participants"][0]["join"]["bgcolor"] = {
								price: isUndefined(price) || price > 0 ? COLOR.Black : COLOR.Green,
								credit: isUndefined(credit) || credit > 20 ? COLOR.Black : credit < 10 ? COLOR.Red : COLOR.Yellow,
								bonus: (weekTrack[2] <= 4 || weekTrack[1] === 7) ? COLOR.Black : COLOR.Yellow,
							}
							if (bgcolor?.price !== COLOR.Black && status?.eventNote)
								bgcolor.priceTip = status.eventNote.startsWith('Bonus: ')
									? status.eventNote.split(':')[1].trim()
									: status?.eventNote;
							if (bgcolor.credit !== COLOR.Black) {
								bgcolor.creditTip = (credit || 0) <= 0 ? 'TopUp Due' : (credit || 0) < 10 ? 'Low Credit' : 'Credit Alert'
							}
							if (status?.bonus)
								bgcolor.bonusTip = status.bonus.indexOf('>')
									? status.bonus.split('>')[1].split('<')[0]
									: status.bonus

							if (idx !== -1) {
								const pdx = this.#meetings[idx].participants.findIndex(party => party.user_id === user_id);
								const leave = this.#meetings[idx].participants[pdx]?.leave;	// in case Join-update where Member already Left

								this.#meetings[idx].participants[pdx === -1 ? this.#meetings[idx].participants.length : pdx] = {
									participant_id, user_id, user_name, leave,
									join: { [FIELD.Id]: doc[FIELD.Id], [FIELD.Stamp]: doc[FIELD.Stamp], white: doc.white!, join_time, label, price, credit, fgcolor, bgcolor },
								}
							}
						});

					(track as zoom.Event<zoom.Left>[])										// add Participants.Left
						.filter(doc => getPath(doc, zoom.EVENT.Type) === zoom.EVENT.Left)
						.forEach(doc => {
							const { id: participant_id, user_id, user_name, leave_time } = doc.body.payload.object.participant;
							const label = fmtInstant(Instant.FORMAT.HHMI, leave_time);
							const idx = this.#meetings.findIndex(meeting => meeting.uuid === doc.body.payload.object.uuid);

							if (idx !== -1) {
								const pdx = this.#meetings[idx].participants.findIndex(party => party.user_id === user_id);
								if (pdx === -1) {										// Leave without a corresponding Join, so create dummy Join
									this.#meetings[idx].participants.push({
										participant_id, user_id, user_name,
										join: { [FIELD.Id]: '', [FIELD.Stamp]: -1, white: {}, join_time: leave_time, label: '', },
										leave: { [FIELD.Id]: doc[FIELD.Id], [FIELD.Stamp]: doc[FIELD.Stamp], leave_time, label },
									})
								}
								else this.#meetings[idx].participants[pdx].leave = { [FIELD.Id]: doc[FIELD.Id], [FIELD.Stamp]: doc[FIELD.Stamp], leave_time, label }
							}
						});

					if (this.#dateChange) {
						this.#dateChange = false;
						this.selectedIndex = this.#meetings.length - 1;
					}
					return this.#meetings;
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
			fire.addWhere(FIELD.Type, zoom.EVENT.Joined),
			fire.addWhere('white.alias', white.alias),
			fire.addWhere('track.week', this.date.format(Instant.FORMAT.yearWeek)),
		]
		const [join, sheet] = await Promise.all([
			this.data.listen<zoom.Event<zoom.Joined>>(COLLECTION.Zoom, { where }),
			this.state.getSingle<Sheet>(STORE.Sheet, fire.addWhere(FIELD.Uid, white.alias))
		])

		const image = sheet.picture;
		const title = white.alias;
		const subtitle = `Attends this week for <span style="font-weight:bold;">${sheet.userName}</span>`;
		const actions = ['Close'];
		const attends: { date: number, attend?: string }[] = [];

		const obs$ = join.pipe(
			takeUntil(this.#stop$),												// teardown Subject

			map(docs => docs.filter(doc => !isUndefined(doc.white?.price))),
			map(docs => docs.map(doc => {
				const { class: event, price } = doc.white || {};
				const color = this.#colorCache(doc.white);
				const { join_time } = doc.body.payload.object.participant || [];
				const join = new Instant(join_time);

				const fmt = `
				<tr>
				<td>${join.format('ddd')}</td>
				<td>${join.format('HH:MM')} </td>
				<td style="color:${color};font-weight:bold;" > ${event} </td>
				<td align = "right" > ${asCurrency(price!)} </td>
				</tr>`;
				return attends.push({ date: doc[FIELD.Stamp], attend: fmt });
			})
			),
			switchMap(_ => of(attends
				.orderBy(FIELD.Date)
				.map(list => list.attend)
			)),
		)

		this.dialog.open({ image, title, subtitle, actions, observe: obs$ });
	}

	setColor(white?: zoom.White) {
		return (white?.class && this.#color[white.class as CLASS].color) || COLOR.Black;
	}
}
