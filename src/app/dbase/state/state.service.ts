import { Injectable } from '@angular/core';
import { Observable, of, combineLatest } from 'rxjs';
import { map, take, switchMap } from 'rxjs/operators';
import { Select } from '@ngxs/store';

import { IAuthState } from '@dbase/state/auth.action';
import { TStateSlice, IAttendState, IPaymentState, IApplicationState, IAdminState } from '@dbase/state/state.define';
import { IMemberState, IPlanState, ITimetableState, IState, IAccountState, IUserState } from '@dbase/state/state.define';
import { joinDoc, sumPayment, sumAttend, calendarDay, buildTimetable, buildPlan, getDefault, getCurrent, getStore, getState } from '@dbase/state/state.library';

import { DBaseModule } from '@dbase/dbase.module';
import { STORE, FIELD, BONUS } from '@dbase/data/data.define';
import { SORTBY } from '@library/config.define';
import { IStoreMeta, IRegister, IStatusConnect, IStatusAccount } from '@dbase/data/data.schema';
import { addWhere } from '@dbase/fire/fire.library';
import { TWhere } from '@dbase/fire/fire.interface';

import { asArray } from '@lib/array.library';
import { DATE_FMT, TDate, getDate } from '@lib/date.library';
import { cloneObj, sortKeys } from '@lib/object.library';
import { dbg } from '@lib/logger.library';

/**
 * StateService will wire-up Observables on the NGXS Store.  
 * It also has helper-methods to perform 'Joins' between related Store-documents
 */
@Injectable({ providedIn: DBaseModule })
export class StateService {
	@Select() private auth$!: Observable<IAuthState>;
	@Select() private client$!: Observable<TStateSlice<IStoreMeta>>;
	@Select() private member$!: Observable<TStateSlice<IStoreMeta>>;
	@Select() private attend$!: Observable<TStateSlice<IStoreMeta>>;
	@Select() private admin$!: Observable<TStateSlice<IStoreMeta>>;
	@Select() private local$!: Observable<TStateSlice<IStoreMeta>>;

	private dbg = dbg(this);
	public states: IState;

	constructor() {
		this.states = {                   // a Lookup map for Slice-to-State
			'client': this.client$,
			'member': this.member$,
			'attend': this.attend$,
			'admin': this.admin$,
			'local': this.local$,
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

	getDefault(state: IApplicationState, type: string) {
		return getDefault(state, type);
	}

	asPromise<T>(obs: Observable<T>) {
		return obs
			.pipe(take(1))									// only the first snapshot
			.toPromise();
	}

	getLatest<T>(...obs: Observable<T>[]) {
		return combineLatest(...obs)
			.pipe(take(1))
			.toPromise()
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
	 */
	getAdminData(): Observable<IAdminState> {
		return this.admin$.pipe(
			map(source => ({
				[STORE.register]: source[STORE.register] as IRegister[],
				account: source.account as IStatusAccount[],
				connect: source.connect as IStatusConnect[],
				dash: [...(source[STORE.register] || [])]
					.sort(sortKeys(...asArray(SORTBY[STORE.register])))
					.map(reg => ({
						[STORE.register]: reg as IRegister,
						account: (source.account || [])
							.find(account => account[FIELD.uid] === reg[FIELD.uid]) as IStatusAccount,
						connect: (source.connect || [])
							.find(connect => connect[FIELD.uid] === reg[FIELD.uid]) as IStatusConnect,
					})),
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
		return this.getMemberData(date).pipe(
			joinDoc(this.states, 'client', STORE.plan, undefined, date),
			joinDoc(this.states, 'client', STORE.price, undefined, date),
			map(table => buildPlan(table)),
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
	 * Assemble an Object describing the Timetable for a specified date, as , where keys are:  
	 * schedule   -> has an array of Schedule info for the weekday of the date  
	 * calendar		-> has the Calendar event for that date (to override regular class)  
	 * event			-> has the Events that are indicated on that calendar
	 * class      -> has the Classes that are available on that schedule or event  
	 * location   -> has the Locations that are indicated on that schedule or calendar
	 * instructor -> has the Instructors that are indicated on that schedule or calendar
	 * span				-> has the Class Duration definitions ('full' or 'half')
	 * alert			-> has an array of Alert notes to display on the Attend component
	 * bonus			-> has an array of active Bonus schemes
	 * gift				-> has an array of active Gifts available to a Member on the date
	 */
	getScheduleData(date?: TDate, elect?: BONUS) {
		const now = getDate(date);
		const isMine = addWhere(FIELD.uid, `{{auth.current.uid}}`);
		const isPrior = addWhere(`track.${FIELD.date}`, now.format(DATE_FMT.yearMonthDay), '<');

		const filterSchedule = addWhere('day', now.dow);
		const filterCalendar = addWhere(FIELD.key, now.format(DATE_FMT.yearMonthDay));
		const filterEvent = addWhere(FIELD.key, `{{client.calendar.${FIELD.type}}}`);
		const filterTypeClass = addWhere(FIELD.key, `{{client.schedule.${FIELD.key}}}`);
		const filterTypeEvent = addWhere(FIELD.key, `{{client.event.classes}}`);
		const filterLocation = addWhere(FIELD.key, ['{{client.schedule.location}}', '{{client.calendar.location}}']);
		const filterInstructor = addWhere(FIELD.key, ['{{client.schedule.instructor}}', '{{client.calendar.instructor}}']);
		const filterSpan = addWhere(FIELD.key, [`{{client.class.${FIELD.type}}}`, `{{client.class.${FIELD.key}}}`]);
		const filterAlert = [
			addWhere(FIELD.type, STORE.schedule),
			addWhere('location', ['{{client.schedule.location}}', '{{client.calendar.location}}']),
		]
		const filterRange = [
			addWhere(FIELD.effect, Number.MIN_SAFE_INTEGER, '>'),
			addWhere(FIELD.expire, Number.MAX_SAFE_INTEGER, '<'),
		]
		const attendGift = [isMine, addWhere(`bonus.${FIELD.id}`, `{{member.gift[*].${FIELD.id}}}`)];
		const attendWeek = [isMine, isPrior, addWhere('track.week', now.format(DATE_FMT.yearWeek))];
		const attendMonth = [isMine, isPrior, addWhere('track.month', now.format(DATE_FMT.yearMonth))];
		const attendToday = [isMine, addWhere(`track.${FIELD.date}`, now.format(DATE_FMT.yearMonthDay))];

		return this.getMemberData(date).pipe(
			joinDoc(this.states, 'client', STORE.schedule, filterSchedule, date),								// whats on this weekday
			joinDoc(this.states, 'client', STORE.calendar, filterCalendar, date, calendarDay),	// get calendar for this date
			joinDoc(this.states, 'client', STORE.calendar, filterRange, date),									// get any blocked calendar-range
			joinDoc(this.states, 'client', STORE.event, filterEvent, date),											// get event for this calendar-date
			joinDoc(this.states, 'client', STORE.class, filterTypeClass, date),									// get classes for this weekday
			joinDoc(this.states, 'client', STORE.class, filterTypeEvent, date),									// get classes for this calendar-date
			joinDoc(this.states, 'client', STORE.location, filterLocation, date),								// get location for this timetable
			joinDoc(this.states, 'client', STORE.instructor, filterInstructor, date),						// get instructor for this timetable
			joinDoc(this.states, 'client', STORE.span, filterSpan, date),												// get class durations
			joinDoc(this.states, 'client', STORE.alert, filterAlert, date),											// get any Alert message for this date
			joinDoc(this.states, 'client', STORE.bonus, undefined, date),												// get any active Bonus
			joinDoc(this.states, 'member', STORE.gift, isMine, date),														// get any active Gifts
			joinDoc(this.states, 'attend.attendGift', STORE.attend, attendGift),								// get any Attends against active Gifts
			joinDoc(this.states, 'attend.attendWeek', STORE.attend, attendWeek),								// get any Attends against this week
			joinDoc(this.states, 'attend.attendMonth', STORE.attend, attendMonth),							// get any Attends against this month
			joinDoc(this.states, 'attend.attendToday', STORE.attend, attendToday),							// get any Attends against this day
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
			addWhere(FIELD.key, now.startOf('week').format(DATE_FMT.yearMonthDay), '>='),
			addWhere(FIELD.key, now.endOf('week').format(DATE_FMT.yearMonthDay), '<='),
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