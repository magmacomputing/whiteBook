import { Component, OnInit, OnDestroy } from '@angular/core';

import { Observable, BehaviorSubject, Subject } from 'rxjs';
import { map, switchMap, mergeMap, takeUntil, tap } from 'rxjs/operators';

import { addWhere, addOrder } from '@dbase/fire/fire.library';
import { COLLECTION, FIELD, Zoom, STORE, CLASS, COLOR } from '@dbase/data/data.define';
import { TWhere } from '@dbase/fire/fire.interface';
import { DataService } from '@dbase/data/data.service';
import { IMeeting, IZoom, TStarted, TEnded, TJoined, TLeft, IClass, IWhite, IImport } from '@dbase/data/data.schema';
import { DialogService } from '@service/material/dialog.service';

import { Instant, fmtDate } from '@library/instant.library';
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
	private dbg = dbg(this);
	public date!: Instant;															// the date for the Schedule to display
	public offset!: number;															// the number of days before today 
	private dateChange = false;													// used to set the selectedIndex

	public firstPaint = true;                           // indicate first-paint
	public selectedIndex: number = 0;                   // used by UI to swipe between <tabs>

	private stop$ = new Subject();											// notify Subscriptions to complete
	private meetings: IMeeting[] = [];
	private meetingDate = new BehaviorSubject<Instant>(new Instant());
	public meetings$!: Observable<IMeeting[]>;					// the date's Meetings

	private color!: Record<CLASS, IClass>;
	private colorCache!: (white: IWhite | undefined) => COLOR

	constructor(private data: DataService, public dialog: DialogService) {
		setTimer(this.stop$)
			.subscribe(_val => {														// watch for midnight
				this.dbg('alarm');
				this.setDate(0);															// force refresh of UI
			});
		this.getMeetings();																// wire-up the Meetings Observable
		this.setDate(0);
		this.getColor();
	}

	private async getColor() {
		this.color = await this.data.getStore<IClass>(STORE.class)
			.then(store => store.groupBy<CLASS>(FIELD.key))
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
		const today = new Instant().startOf('day');
		const offset = dir === 0
			? today
			: new Instant(this.date).add(dir, 'days')

		this.offset = today.diff('days', offset);
		this.date = this.offset > 6 && false							// only allow up-to 6 days in the past
			? today																					// else reset to today
			: offset

		this.meetingDate.next(this.date);									// give the date to the Observable
	}

	/**
	 * first get the meeting.started  Events for this.date  to determined uuid's.  
	 * then collect all documents that relate to those uuid's,  
	 * then assemble details into an IMeeting[]
	 */
	private getMeetings() {
		return this.meetings$ = this.meetingDate					// wait on the Subject
			.pipe(
				takeUntil(this.stop$),												// teardown Subject
				tap(_ => this.meetings = []),									// reset the assembled details
				tap(_ => this.dateChange = true),							// move the selectedIndex to latest meeting

				switchMap(inst =>															// get all meeting.started events for this.date
					this.data.getLive<IZoom<TStarted>>(COLLECTION.zoom, {
						where: [
							addWhere(FIELD.type, Zoom.EVENT.started),
							addWhere('track.date', inst.format(Instant.FORMAT.yearMonthDay)),
						]
					})
				),

				mergeMap(track => {														// merge with all events for the meeting.started events
					track
						.sort((a, b) => a[FIELD.stamp] - b[FIELD.stamp])
						.forEach(doc => {
							const { id: meeting_id, start_time, uuid, ...rest } = doc.body.payload.object;
							const label = fmtDate(Instant.FORMAT.HHMI, doc.stamp);
							const color = this.colorCache(doc.white);
							const idx = this.meetings.findIndex(meeting => meeting.uuid === uuid);

							if (idx === -1) {
								this.meetings.push({
									uuid, meeting_id, participants: [], ...rest,
									start: {
										[FIELD.id]: doc[FIELD.id], [FIELD.stamp]: doc[FIELD.stamp],
										white: doc.white, start_time, label, color
									},
								})

								if (!this.dateChange)									// a new meeting.started today
									this.dateChange = this.date.format(Instant.FORMAT.yearMonthDay) === new Instant().format(Instant.FORMAT.yearMonthDay);
							} else {																// change to existing meeting
								this.meetings[idx].start = { ...this.meetings[idx].start, white: doc.white, color };
							}
						})

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

					if (this.dateChange) {
						this.dateChange = false;
						this.selectedIndex = this.meetings.length - 1;
					}
					return this.meetings;
				}),
			)
	}

	/**
	 * Popup an attend-this-week summary
	 */
	async showWeek(white: IWhite) {
		if (isUndefined(white))
			return;
		if (!white.alias)
			return;
		if (!white.status?.trackDaysThisWeek)
			return;

		const where: TWhere = [
			addWhere(FIELD.type, Zoom.EVENT.joined),
			addWhere('white.alias', white.alias),
			addWhere('track.week', this.date.format(Instant.FORMAT.yearWeek)),
		]
		const [join, imports] = await Promise.all([
			this.data.getFire<IZoom<TJoined>>(COLLECTION.zoom, { where, orderBy: addOrder(FIELD.stamp) }),
			this.data.getFire<IImport>(COLLECTION.admin, { where: [addWhere(FIELD.uid, white.alias), addWhere(FIELD.store, STORE.import)] })
		])

		const image = imports[0].picture;
		const title = white.alias;
		const subtitle = `Attends this week for ${imports[0].userName}`;
		const actions = ['Close'];

		let content: string[] = [];
		join
			.filter(doc => !isUndefined(doc.white?.price))
			.forEach(doc => {
				const { class: event, price } = doc.white || {};
				const color = this.colorCache(doc.white);
				const { user_name, join_time } = doc.body.payload.object.participant || {};
				content.push(`
					${new Instant(join_time).format('ddd, HH:MM')} 
					${event}
					${asCurrency(price!)}
				`)
			})

		this.dialog.open({ image, title, subtitle, actions, content });
	}

	setColor(white?: IWhite) {
		return (white?.class && this.color[white.class as CLASS].color) || COLOR.black;
	}
}
