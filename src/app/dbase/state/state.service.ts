import { Injectable } from '@angular/core';
import { Observable, of, combineLatest } from 'rxjs';
import { map, take, switchMap, startWith, distinctUntilChanged } from 'rxjs/operators';
import { Select } from '@ngxs/store';

import { IAuthState } from '@dbase/state/auth.action';
import { TStateSlice, IAttendState, IPaymentState, IApplicationState, IAdminState, IProviderState, IForumState } from '@dbase/state/state.define';
import { IMemberState, IPlanState, ITimetableState, IState, IAccountState, IUserState } from '@dbase/state/state.define';
import { joinDoc, sumPayment, sumAttend, calendarDay, buildTimetable, buildPlan, getDefault, getCurrent, getStore, getState, buildProvider } from '@dbase/state/state.library';

import { DBaseModule } from '@dbase/dbase.module';
import { STORE, FIELD, BONUS, COLLECTION } from '@dbase/data/data.define';
import { SORTBY } from '@library/config.define';
import { IStoreMeta, IRegister, IStatusConnect, IStatusAccount, IForumBase, IComment, IReact, IImport } from '@dbase/data/data.schema';

import { FireService } from '@dbase/fire/fire.service';
import { addWhere, addOrder } from '@dbase/fire/fire.library';
import { TWhere, IQuery } from '@dbase/fire/fire.interface';

import { asArray } from '@lib/array.library';
import { Instant, TDate, getDate } from '@lib/instant.library';
import { cloneObj, sortKeys } from '@lib/object.library';
import { dbg } from '@lib/logger.library';
import { sortedChanges } from '@angular/fire/firestore';

/**
 * StateService will wire-up Observables on the NGXS Store.  
 * It also has helper-methods to perform 'Joins' between related Store-documents
 */
@Injectable({ providedIn: DBaseModule })
export class StateService {
	@Select() auth$!: Observable<IAuthState>;
	@Select() client$!: Observable<TStateSlice<IStoreMeta>>;
	@Select() member$!: Observable<TStateSlice<IStoreMeta>>;
	@Select() attend$!: Observable<TStateSlice<IStoreMeta>>;
	@Select() admin$!: Observable<TStateSlice<IStoreMeta>>;
	@Select() local$!: Observable<TStateSlice<IStoreMeta>>;
	private forum$: Observable<TStateSlice<IStoreMeta>> = of({ forum: [] });

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
	getCurrent<T>(store: STORE, where?: TWhere) {
		const filters = asArray(where);
		filters.push(addWhere(FIELD.expire, 0));
		filters.push(addWhere(FIELD.hidden, false));

		return getCurrent<T>(this.states, store, filters);
	}

	getStore<T>(store: STORE, where?: TWhere, date?: TDate) {
		return getStore<T>(this.states, store, where, date);
	}

	getState<T>(store: STORE, where?: TWhere) {
		return getState<T>(this.states, store, where);
	}

	getSingle<T>(store: STORE, filter: TWhere) {
		return this.asPromise(this.getCurrent<T>(store, filter))
			.then(table => table[0]);				// only the first document
	}

	/** lookup the Default store for a given 'type' */
	getDefault(state: IApplicationState, type: string) {
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
	getAuthData(): Observable<IUserState> {
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
	getAdminData(): Observable<IAdminState> {
		return this.admin$.pipe(
			map(source => ({
				[STORE.register]: source[STORE.register] as IRegister[],
				[STORE.account]: source[STORE.account] as IStatusAccount[],
				[STORE.connect]: source[STORE.connect] as IStatusConnect[],
				[STORE.import]: source[STORE.import] as IImport[],
				dash: [...(source[STORE.register] || [])]
					.sort(sortKeys(...asArray(SORTBY[STORE.register])))
					.map(reg => ({
						[STORE.register]: reg as IRegister,
						[STORE.account]: (source[STORE.account] || [])
							.find(account => account[FIELD.uid] === reg[FIELD.uid]) as IStatusAccount,
						[STORE.connect]: (source[STORE.connect] || [])
							.find(connect => connect[FIELD.uid] === reg[FIELD.uid]) as IStatusConnect,
						[STORE.import]: (source[STORE.import] || [])
							.find(migrate => migrate[FIELD.uid] === reg[FIELD.uid]) as IImport,
					}))
			}))
		)
	}

	/**
	 * Watch for changes on the Member's Attendance
	 */
	getAttendData(payment?: string): Observable<IAttendState> {
		const filterAttend = [
			addWhere(FIELD.store, STORE.attend),
			addWhere(FIELD.uid, '{{auth.current.uid}}'),
		];
		if (payment)
			filterAttend.push(addWhere(`${STORE.payment}.${FIELD.id}`, payment))

		return this.attend$.pipe(
			joinDoc(this.states, 'application', STORE.default),
			joinDoc(this.states, 'account.attend', STORE.attend, filterAttend),
		)
	}

	/**
	 * Watch for changes on the Member's Payments
	 */
	getPaymentData(): Observable<IPaymentState> {
		const filterPayment = [
			addWhere(FIELD.store, STORE.payment),
			addWhere(FIELD.uid, '{{auth.current.uid}}'),
		]

		return this.getMemberData().pipe(
			joinDoc(this.states, 'account.payment', STORE.payment, filterPayment),
		)
	}

	/**
	 * Extend AuthState with an Object describing a Member returned as IMemberState, where:  
	 * application._default -> has the current defaults to be used where join-fields are undefined
	 * member.plan  -> has the asAt ProfilePlan for the user.uid  
	 * member.info  -> has the additionalUserInfo ProfileUser documents for the user.uid  
	 * member.gift	-> has an array of Member gifts  
	 * client.price -> has an array of IPrice that match the Member's plan-type
	 * client.plan  -> has array of the asAt IPlan description
	 * 
	 * @param date:	number	An optional as-at date to determine rows in an effective date-range
	 */
	getMemberData(date?: TDate): Observable<IMemberState> {
		const filterProfile = [
			addWhere(FIELD.type, ['plan', 'info', 'gift', 'account']),   // where the <type> is either 'plan', 'info', 'gift' or 'account'
			addWhere(FIELD.uid, '{{auth.current.uid}}'),  		// and the <uid> is current active User
		]
		const filterPlan = addWhere(FIELD.key, '{{member.plan[0].plan}}');
		const filterMessage = addWhere(FIELD.type, 'alert');

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
	getPlanData(date?: TDate): Observable<IPlanState> {
		const filterIcon = addWhere(FIELD.type, [STORE.plan, STORE.default]);

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
	getProviderData(date?: TDate): Observable<IProviderState> {
		const filterProvider = addWhere(FIELD.expire, 0);
		const filterIcon = addWhere(FIELD.type, [STORE.provider, STORE.default]);

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
	 * account.summary-> has an object summarising the Member's account value as { paid: $, bank: $, adjust: $, spend: $, credit: $, funds: $ }
	 */
	getAccountData(date?: TDate): Observable<IAccountState> {
		const filterPayment = [
			addWhere(FIELD.store, STORE.payment),
			addWhere(FIELD.uid, '{{auth.current.uid}}'),
		];
		const filterAttend = [
			addWhere(`payment.${FIELD.id}`, `{{account.payment[0].${FIELD.id}}}`),
			addWhere(FIELD.uid, '{{auth.current.uid}}'),
		];

		return combineLatest(this.getAttendData(), this.getPaymentData()).pipe(
			switchMap(_ => this.getMemberData(date)),
			joinDoc(this.states, 'account.payment', STORE.payment, filterPayment, undefined, sumPayment),
			joinDoc(this.states, 'account.attend', STORE.attend, filterAttend, undefined, sumAttend),
		)
	}

	/**
	 * Observe Forum data direct from FireStore (because it is not persisted to local Store)
	 * forum.comment	-> has an array of Comments about this date's schedule
	 * forum.react		-> has an array of Reacts about this date's schedule
	 */
	getForumData(date?: TDate): Observable<IForumState> {
		const query: IQuery = {
			where: addWhere('track.date', getDate(date).format(Instant.FORMAT.yearMonthDay)),
			orderBy: addOrder(FIELD.stamp),
		}

		return this.fire.listen<IForumBase>(COLLECTION.forum, query, 'snapshotChanges').pipe(
			startWith([] as IForumBase[]),													// dont make subcriber wait for 1st emit
			distinctUntilChanged((curr, prev) => JSON.stringify(curr) === JSON.stringify(prev)),
			map(source => ({
				forum: {
					[STORE.react]: source.filter(row => row[FIELD.store] === STORE.react) as IReact[],
					[STORE.comment]: source.filter(row => row[FIELD.store] === STORE.comment) as IComment[],
				}
			})),
		)
	}

	/**
	 * Assemble an Object describing the Timetable for a specified date, where keys are:  
	 * schedule   -> has an array of Schedule info for the weekday of the date  
	 * calendar		-> has the Calendar event for that date (to override regular class)  
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
	getScheduleData(date?: TDate, elect?: BONUS): Observable<ITimetableState> {
		const now = getDate(date);
		const isMine = addWhere(FIELD.uid, `{{auth.current.uid}}`);
		const notToday = addWhere(`track.${FIELD.date}`, now.format(Instant.FORMAT.yearMonthDay), '!=');

		const filterSchedule = addWhere('day', now.dow);
		const filterEvent = addWhere(FIELD.key, `{{client.calendar.${FIELD.type}}}`);
		const filterTypeClass = addWhere(FIELD.key, `{{client.schedule.${FIELD.key}}}`);
		const filterTypeEvent = addWhere(FIELD.key, `{{client.event.agenda}}`);
		const filterLocation = addWhere(FIELD.key, ['{{client.schedule.location}}', '{{client.calendar.location}}']);
		const filterInstructor = addWhere(FIELD.key, ['{{client.schedule.instructor}}', '{{client.calendar.instructor}}']);
		const filterSpan = addWhere(FIELD.key, [`{{client.class.${FIELD.type}}}`, `{{client.class.${FIELD.key}}}`]);
		const filterIcon = addWhere(FIELD.type, [STORE.class, STORE.default]);
		const filterAlert = [
			addWhere(FIELD.type, STORE.schedule),
			addWhere('location', ['{{client.schedule.location}}', '{{client.calendar.location}}']),
		]
		const attendGift = [isMine, addWhere(`bonus.${FIELD.id}`, `{{member.gift[*].${FIELD.id}}}`)];
		const attendWeek = [isMine, notToday, addWhere('track.week', now.format(Instant.FORMAT.yearWeek))];
		const attendMonth = [isMine, notToday, addWhere('track.month', now.format(Instant.FORMAT.yearMonth))];
		const attendToday = [isMine, addWhere(`track.${FIELD.date}`, now.format(Instant.FORMAT.yearMonthDay))];

		return combineLatest(this.getForumData(date), this.getMemberData(date)).pipe(
			map(([forum, member]) => ({ ...forum, ...member })),
			joinDoc(this.states, 'application', STORE.default, addWhere(FIELD.type, STORE.icon)),
			joinDoc(this.states, 'client', STORE.schedule, filterSchedule, date),								// whats on this weekday
			joinDoc(this.states, 'client', STORE.calendar, undefined, date, calendarDay),				// get calendar for this date
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
			joinDoc(this.states, 'attend.attendToday', STORE.attend, attendToday),							// get any Attends for this day)
			map(table => buildTimetable(table, date, elect)),																		// assemble the Timetable
		) as Observable<ITimetableState>																											// declare Type (to override pipe()'s artificial limit of 'nine' declarations)
	}

	/**
	 * Assemble a standalone Object describing the Schedule for the week (Mon-Sun) that matches the supplied date.  
	 * It will take the ITimetable format (described in getTimetableData)
	 */
	getTimetableData(date?: TDate): Observable<ITimetableState> {
		const now = getDate(date);
		const filterClass = addWhere(FIELD.key, `{{client.schedule.${FIELD.key}}}`);
		const filterLocation = addWhere(FIELD.key, '{{client.schedule.location}}');
		const filterCalendar = [
			addWhere(FIELD.key, now.startOf('week').format(Instant.FORMAT.yearMonthDay), '>='),
			addWhere(FIELD.key, now.endOf('week').format(Instant.FORMAT.yearMonthDay), '<='),
		]
		const filterEvent = addWhere(FIELD.key, `{{client.calendar.${FIELD.type}}}`);

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