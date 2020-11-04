import { Injectable } from '@angular/core';
import { Observable, of, combineLatest } from 'rxjs';
import { map, take, startWith, distinctUntilChanged } from 'rxjs/operators';
import { Select } from '@ngxs/store';

import { AuthSlice } from '@dbase/state/auth.action';
import { TStateSlice, ApplicationState, AdminState, ProviderState, ForumState } from '@dbase/state/state.define';
import { MemberState, PlanState, TimetableState, IState, OState, AccountState, UserState } from '@dbase/state/state.define';
import { joinDoc, sumPayment, sumAttend, calendarDay, buildTimetable, buildPlan, getDefault, getCurrent, getStore, getState, buildProvider } from '@dbase/state/state.library';

import { DBaseModule } from '@dbase/dbase.module';
import { STORE, FIELD, BONUS, COLLECTION } from '@dbase/data/data.define';
import { FireDocument, Register, StatusConnect, StatusAccount, ForumDocument, Comment, React, Import } from '@dbase/data/data.schema';

import { FireService } from '@dbase/fire/fire.service';
import { Fire } from '@dbase/fire/fire.library';

import { Instant, TInstant, getInstant } from '@library/instant.library';
import { cloneObj } from '@library/object.library';
import { asArray } from '@library/array.library';
import { dbg } from '@library/logger.library';

/**
 * StateService will wire-up Observables on the NGXS Store.  
 * It also has helper-methods to perform 'Joins' between related Store-documents
 */
@Injectable({ providedIn: DBaseModule })
export class StateService {
	@Select() auth$!: Observable<AuthSlice>;
	@Select() client$!: OState;
	@Select() member$!: OState;
	@Select() attend$!: OState;
	@Select() admin$!: OState;
	@Select() local$!: Observable<TStateSlice<FireDocument>>;
	private forum$: OState = of({ forum: [] });

	private dbg = dbg(this);
	public states: IState;

	constructor(private fire: FireService) {
		this.states = {                   // a Lookup map for Slice-to-State
			'client': this.client$,
			'member': this.member$,
			'attend': this.attend$,
			'admin': this.admin$,
			'local': this.local$,
			'forum': this.forum$,
		}
	}

	/** Fetch the current, useable values for a supplied store */
	getCurrent<T>(store: STORE, where?: Fire.Query["where"] ) {
		const filters = asArray(where);
		filters.push(Fire.addWhere(FIELD.expire, 0));
		filters.push(Fire.addWhere(FIELD.hidden, false));

		return getCurrent<T>(this.states, store, filters);
	}

	getStore<T>(store: STORE, where?: Fire.Query["where"] , date?: TInstant) {
		return getStore<T>(this.states, store, where, date);
	}

	getState<T>(store: STORE, where?: Fire.Query["where"] ) {
		return getState<T>(this.states, store, where);
	}

	getSingle<T>(store: STORE, filter: Fire.Query["where"] ) {
		return this.asPromise(this.getCurrent<T>(store, filter))
			.then(table => table[0]);				// only the first document
	}

	/** lookup the Default store for a given 'type' */
	getDefault(state: ApplicationState, type: string) {
		return getDefault(state, type);
	}

	asPromise<T>(obs: Observable<T>) {
		return obs
			.pipe(take(1))									// only the first snapshot
			.toPromise();
	}

	/**
	* Assemble a UserState Object describing an authenticated User
	*/
	getAuthData(): Observable<UserState> {
		return this.auth$.pipe(
			map(auth => ({ auth: cloneObj(auth) })),
		)
	}

	/**
	 * Assemble an AdminState Object describing stores only available to Members with 'admin' role
	 * dash.register	-> has an array of the current state of /admin/register
	 * dash.account		-> has an array of the current value of /admin/account
	 * dash.connect 	-> has an array of the current connections in /admin/connect
	 * dash.import		-> has an array of the current state of /admin/import
	 */
	getAdminData(): Observable<AdminState> {
		return this.admin$.pipe(
			map(source => ({
				[STORE.register]: source[STORE.register] as Register[],
				[STORE.account]: source[STORE.account] as StatusAccount[],
				[STORE.connect]: source[STORE.connect] as StatusConnect[],
				[STORE.import]: source[STORE.import] as Import[],
				dash: [...(source[STORE.register] || [])]
					.orderBy('user.customClaims.alias', FIELD.uid)
					.map(reg => ({
						[STORE.register]: reg as Register,
						[STORE.account]: (source[STORE.account] || [])
							.find(account => account[FIELD.uid] === reg[FIELD.uid]) as StatusAccount,
						[STORE.connect]: (source[STORE.connect] || [])
							.find(connect => connect[FIELD.uid] === reg[FIELD.uid]) as StatusConnect,
						[STORE.import]: (source[STORE.import] || [])
							.find(import_ => import_[FIELD.uid] === reg[FIELD.uid]) as Import
					}))
			}))
		)
	}

	/**
	 * Watch for changes on the Member's Attendance
	 */
	// getAttendData(payment?: string): Observable<AttendState> {
	// 	const filterAttend = [
	// 		fire.addWhere(FIELD.store, STORE.attend),
	// 		fire.addWhere(FIELD.uid, '{{auth.current.uid}}'),
	// 	];
	// 	if (payment)
	// 		filterAttend.push(fire.addWhere(`${STORE.payment}.${FIELD.id}`, payment))

	// 	return this.attend$.pipe(
	// 		switchMap(_attnd => this.getAuthData()),
	// 		joinDoc(this.states, 'application', STORE.default),
	// 		joinDoc(this.states, 'attend', STORE.attend, filterAttend),
	// 	)
	// }

	/**
	 * Watch for changes on the Member's Payments
	 */
	// getPaymentData(): Observable<PaymentState> {
	// 	const filterPayment = [
	// 		fire.addWhere(FIELD.store, STORE.payment),
	// 		fire.addWhere(FIELD.uid, '{{auth.current.uid}}'),
	// 	]

	// 	return this.getMemberData().pipe(
	// 		joinDoc(this.states, 'account.payment', STORE.payment, filterPayment),
	// 	)
	// }

	/**
	 * Extend AuthState with an Object describing a Member returned as MemberState, where:  
	 * application._default -> has the current defaults to be used where join-fields are undefined  
	 * member.plan  -> has the asAt ProfilePlan for the user.uid  
	 * member.info  -> has the additionalUserInfo ProfileUser documents for the user.uid  
	 * member.gift	-> has an array of Member gifts  
	 * client.price -> has an array of Price that match the Member's plan-type  
	 * client.plan  -> has array of the asAt Plan description
	 * 
	 * @param date:	number	An optional as-at date to determine rows in an effective date-range
	 */
	getMemberData(date?: TInstant): Observable<MemberState> {
		const filterProfile = [
			Fire.addWhere(FIELD.type, ['plan', 'info', 'gift', 'account']),   	// where the <type> is either 'plan', 'info', 'gift' or 'account'
			Fire.addWhere(FIELD.uid, '{{auth.current.uid}}'),  								// and the <uid> is current active User
		]
		const filterPlan = Fire.addWhere(FIELD.key, '{{member.plan[0].plan}}');
		const filterMessage = Fire.addWhere(FIELD.type, 'alert');

		return this.getAuthData().pipe(
			joinDoc(this.states, 'application', STORE.default, undefined, date),
			joinDoc(this.states, 'member', STORE.profile, filterProfile, date),
			joinDoc(this.states, 'member.message', STORE.message, filterMessage, date),
			joinDoc(this.states, 'client', STORE.price, filterPlan, date),
			joinDoc(this.states, 'client', STORE.plan, filterPlan, date),
		)
	}

	/**
	 * Add current Plan[] and Price[] to the Member Profile Observable  
	 * client.plan  -> has an array of asAt Plan documents  
	 * client.price -> has an array of asAt Price documents
	 */
	getPlanData(date?: TInstant): Observable<PlanState> {
		const filterIcon = Fire.addWhere(FIELD.type, [STORE.plan, STORE.default]);

		return this.getMemberData(date).pipe(
			joinDoc(this.states, 'client', STORE.plan, undefined, date),
			joinDoc(this.states, 'client', STORE.price, undefined, date),
			joinDoc(this.states, 'client', STORE.icon, filterIcon, date),
			map(table => buildPlan(table)),
		)
	}

	/**
	 * A list of Sign-in Providers
	 * client.provider	-> has an array of Provider documents
	 * client.icon			-> has an array of Provider icons
	 */
	getProviderData(date?: TInstant): Observable<ProviderState> {
		const filterProvider = Fire.addWhere(FIELD.expire, 0);
		const filterIcon = Fire.addWhere(FIELD.type, [STORE.provider, STORE.default]);

		return this.getMemberData(date).pipe(
			joinDoc(this.states, 'client', STORE.provider, filterProvider, date),
			joinDoc(this.states, 'client', STORE.icon, filterIcon, date),
			map(table => buildProvider(table)),
		)
	}

	/**
	 * Add Account details to the Member Profile Observable  
	 * account.payment-> has an array of open (not asAt) details about the Member's account payments  
	 * account.attend	-> has an array of attendances against the <active> payment  
	 * account.summary-> has an object summarising the Member's Account value as { paid: $, bank: $, adjust: $, spend: $, credit: $, funds: $ }
	 */
	getAccountData(date?: TInstant): Observable<AccountState> {
		const filterPayment = [
			Fire.addWhere(FIELD.store, STORE.payment),
			Fire.addWhere(FIELD.uid, '{{auth.current.uid}}'),
		];
		const filterAttend = [
			Fire.addWhere(`payment.${FIELD.id}`, `{{account.payment[0].${FIELD.id}}}`),
			Fire.addWhere(FIELD.uid, '{{auth.current.uid}}'),
		];

		return this.getMemberData(date).pipe(
			joinDoc(this.states, 'account.payment', STORE.payment, filterPayment, undefined, sumPayment),
			joinDoc(this.states, 'account.attend', STORE.attend, filterAttend, undefined, sumAttend),
		)
	}

	/**
	 * Observe Forum data direct from FireStore (because it is not persisted to local Store)
	 * forum.comment	-> has an array of Comments about this date's schedule
	 * forum.react		-> has an array of Reacts about this date's schedule
	 */
	getForumData(date?: TInstant): Observable<ForumState> {
		const query: Fire.Query = {
			where: Fire.addWhere('track.date', getInstant(date).format(Instant.FORMAT.yearMonthDay)),
			orderBy: Fire.addOrder(FIELD.stamp),
		}

		return this.fire.listen<ForumDocument>(COLLECTION.forum, query).pipe(
			startWith([] as ForumDocument[]),													// dont make subcriber wait for 1st emit
			distinctUntilChanged((curr, prev) => JSON.stringify(curr) === JSON.stringify(prev)),
			map(source => ({
				forum: {
					[STORE.react]: source.filter(row => row[FIELD.store] === STORE.react) as React[],
					[STORE.comment]: source.filter(row => row[FIELD.store] === STORE.comment) as Comment[],
				}
			})),
		)
	}

	/**
	 * Assemble an Object describing the Timetable for a specified date, where keys are:  
	 * schedule   -> has an array of Schedule info for the weekday of the date  
	 * calendar		-> has the Calendar event for that date (to override regular class)  
	 * diary			-> has the future Calendar events
	 * event			-> has the Events that are indicated on that calendar
	 * class      -> has the Classes that are available on that schedule or event  
	 * location   -> has the Locations that are indicated on that schedule or calendar
	 * instructor -> has the Instructors that are indicated on that schedule or calendar
	 * span				-> has the Class Duration definitions ('full' or 'half')
	 * forum			-> has an array of Member comments about the Classes available on that schedule or event
	 * alert			-> has an array of Alert notes to display on the Attend component
	 * bonus			-> has an array of active Bonus schemes
	 * gift				-> has an array of active Gifts available to a Member on the date
	 * forum			-> has an array of Forum data for the date
	 */
	getScheduleData(date?: TInstant, elect?: BONUS): Observable<TimetableState> {
		const now = getInstant(date);
		const isMine = Fire.addWhere(FIELD.uid, `{{auth.current.uid}}`);

		const filterSchedule = Fire.addWhere('day', [Instant.WEEKDAY.All, now.dow], 'in');
		const filterCalendar = Fire.addWhere(FIELD.key, now.format(Instant.FORMAT.yearMonthDay), '>');
		const filterEvent = Fire.addWhere(FIELD.key, `{{client.calendar.${FIELD.type}}}`);
		const filterTypeClass = Fire.addWhere(FIELD.key, `{{client.schedule.${FIELD.key}}}`);
		const filterTypeEvent = Fire.addWhere(FIELD.key, `{{client.event.agenda}}`);
		const filterLocation = Fire.addWhere(FIELD.key, ['{{client.schedule.location}}', '{{client.calendar.location}}']);
		const filterInstructor = Fire.addWhere(FIELD.key, ['{{client.schedule.instructor}}', '{{client.calendar.instructor}}']);
		const filterSpan = Fire.addWhere(FIELD.key, [`{{client.class.${FIELD.type}}}`, `{{client.class.${FIELD.key}}}`]);
		const filterIcon = Fire.addWhere(FIELD.type, [STORE.class, STORE.default]);
		const attendGift = [isMine, Fire.addWhere(`bonus.${FIELD.id}`, `{{member.gift[*].${FIELD.id}}}`)];
		const attendWeek = [isMine, Fire.addWhere('track.week', now.format(Instant.FORMAT.yearWeek))];
		const attendMonth = [isMine, Fire.addWhere('track.month', now.format(Instant.FORMAT.yearMonth))];
		const attendToday = [isMine, Fire.addWhere(`track.${FIELD.date}`, now.format(Instant.FORMAT.yearMonthDay))];
		const filterAlert = [
			Fire.addWhere(FIELD.type, STORE.schedule),
			Fire.addWhere('location', ['{{client.schedule.location}}', '{{client.calendar.location}}']),
		]

		return combineLatest([this.getForumData(date), this.getMemberData(date)]).pipe(
			map(([forum, member]) => ({ ...forum, ...member })),
			joinDoc(this.states, 'application', STORE.default, Fire.addWhere(FIELD.type, STORE.icon)),
			joinDoc(this.states, 'client', STORE.schedule, filterSchedule, date),								// whats on this weekday (or every weekday)
			joinDoc(this.states, 'client', STORE.calendar, undefined, date, calendarDay),				// get calendar for this date
			joinDoc(this.states, 'client.diary', STORE.calendar, filterCalendar),								// get future events
			joinDoc(this.states, 'client', STORE.event, filterEvent, date),											// get event for this calendar-date
			joinDoc(this.states, 'client', STORE.class, filterTypeClass, date),									// get classes for this weekday
			joinDoc(this.states, 'client', STORE.class, filterTypeEvent, date),									// get agenda for this calendar-date
			joinDoc(this.states, 'client', STORE.icon, filterIcon, date),												// get the Class icons
			joinDoc(this.states, 'client', STORE.location, filterLocation, date),								// get location for this timetable
			joinDoc(this.states, 'client', STORE.instructor, filterInstructor, date),						// get instructor for this timetable
			joinDoc(this.states, 'client', STORE.span, filterSpan, date),												// get class durations
			joinDoc(this.states, 'client', STORE.alert, filterAlert, date),											// get any Alert message for this date
			joinDoc(this.states, 'client', STORE.bonus, undefined, date),												// get any active Bonus
			joinDoc(this.states, 'member', STORE.gift, isMine, date),														// get any active Gifts
			joinDoc(this.states, 'attend.attendGift', STORE.attend, attendGift),								// get any Attends against active Gifts
			joinDoc(this.states, 'attend.attendWeek', STORE.attend, attendWeek),								// get any Attends for this week
			joinDoc(this.states, 'attend.attendMonth', STORE.attend, attendMonth),							// get any Attends for this month
			joinDoc(this.states, 'attend.attendToday', STORE.attend, attendToday),							// get any Attends for this day
			map(table => buildTimetable(table, date, elect)),																		// assemble the Timetable
		) as Observable<TimetableState>																											// declare Type (to override pipe()'s artificial limit of 'nine' declarations)
	}

	/**
	 * Assemble a standalone Object describing the Schedule for the week (Mon-Sun) that matches the supplied date.  
	 * It will take the ITimetable format (described in getTimetableData)
	 */
	getTimetableData(date?: TInstant): Observable<TimetableState> {
		const now = getInstant(date);
		const filterClass = Fire.addWhere(FIELD.key, `{{client.schedule.${FIELD.key}}}`);
		const filterLocation = Fire.addWhere(FIELD.key, '{{client.schedule.location}}');
		const filterCalendar = [
			Fire.addWhere(FIELD.key, now.startOf('week').format(Instant.FORMAT.yearMonthDay), '>='),
			Fire.addWhere(FIELD.key, now.endOf('week').format(Instant.FORMAT.yearMonthDay), '<='),
		]
		const filterEvent = Fire.addWhere(FIELD.key, `{{client.calendar.${FIELD.type}}}`);

		return of({}).pipe(																						// start with an empty Object
			joinDoc(this.states, 'application', STORE.default, undefined, date),
			joinDoc(this.states, 'client', STORE.schedule, undefined, date),
			joinDoc(this.states, 'client', STORE.class, filterClass, date),
			joinDoc(this.states, 'client', STORE.location, filterLocation, date),
			joinDoc(this.states, 'client', STORE.calendar, filterCalendar, date, calendarDay),
			joinDoc(this.states, 'client', STORE.event, filterEvent, date),
			take(1),
		)
	}
}