import { Injectable } from '@angular/core';
import { Observable, of, from } from 'rxjs';
import { map, take, combineLatest, filter } from 'rxjs/operators';
import { Select } from '@ngxs/store';

import { IAuthState } from '@dbase/state/auth.action';
import { TStateSlice, IAdminState, IAttendState, IPaymentState, } from '@dbase/state/state.define';
import { IMemberState, IPlanState, ITimetableState, IState, IAccountState, IUserState } from '@dbase/state/state.define';
import { joinDoc, sumPayment, sumAttend, calendarDay, buildTimetable, buildPlan, getDefault, getCurrent, getStore } from '@dbase/state/state.library';

import { DBaseModule } from '@dbase/dbase.module';
import { STORE, FIELD, COLLECTION } from '@dbase/data/data.define';
import { IStoreMeta, TStoreBase, IRegister } from '@dbase/data/data.schema';
import { addWhere } from '@dbase/fire/fire.library';
import { TWhere } from '@dbase/fire/fire.interface';
import { FireService } from '@dbase/fire/fire.service';
import { SyncService } from '@dbase/sync/sync.service';

import { asArray } from '@lib/array.library';
import { DATE_FMT, getDate, TDate } from '@lib/date.library';
import { cloneObj } from '@lib/object.library';
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

	constructor(private fire: FireService, private sync: SyncService) {
		this.states = {                   // a Lookup map for Slice-to-State
			'client': this.client$,
			'member': this.member$,
			'attend': this.attend$,
			'admin': this.admin$,
			'local': this.local$,
		}
	}

	/** Fetch the current, useable values for a supplied store */
	getCurrent<T>(store: string, where?: TWhere) {
		const filters = asArray(where);
		filters.push(addWhere(FIELD.expire,  0 ));
		filters.push(addWhere(FIELD.hidden,  false ));

		return getCurrent<T & TStoreBase>(this.states, store, filters);
	}

	getStore<T>(store: string, where?: TWhere) {
		return getStore<T & TStoreBase>(this.states, store, where);
	}

	getSingle<T>(store: string, filter: TWhere) {
		return this.asPromise(this.getCurrent<T>(store, filter))
			.then(table => table[0]);				// only the first document
	}

	getDefault(state: IMemberState, type: string) {
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
	 * Assemble an AdminState Object describing stores only available to Members with 'admin' roles
	 * auth.register	-> has an array of the current state of /register
	 */
	getAdminData(): Observable<IAdminState> {
		return this.admin$.pipe(
			joinDoc(this.states, 'register', STORE.register, undefined, undefined),
		)
	}

	/**
	 * Watch for changes on the Member's Attendance
	 */
	getAttendData(uid?: string) {
		const filterAttend = [
			addWhere(FIELD.store, STORE.attend),
			addWhere(FIELD.uid, uid || '{{auth.user.uid}}'),
		];

		return this.attend$.pipe(
			map(source => {
				let target: TStateSlice<IStoreMeta> = {};
				for (const key in source)
					target[key] = source[key].filter(row => row[FIELD.uid] === uid)
				return target;
			})
		)
	}

	// /**
	//  * Watch for changes on the Member's Payments
	//  */
	// getPaymentData(uid?: string): Observable<IPaymentState> {
	// 	const filterPayment = [
	// 		addWhere(FIELD.uid, uid || '{{auth.user.uid}}'),
	// 		addWhere(FIELD.store, STORE.payment),
	// 	]

	// 	return this.member$.pipe(
	// 		joinDoc(this.states, 'account.payment', STORE.payment, filterPayment),
	// 	)
	// }

	/**
	 * Extend AuthState with an Object describing a Member returned as IMemberState, where:  
	 * default._default -> has the current defaults to be used where join-fields are undefined
	 * member.plan  -> has the asAt ProfilePlan for the user.uid  
	 * member.info  -> has the additionalUserInfo ProfileUser documents for the user.uid  
	 * member.pref	-> has an array of member preferences  
	 * member.price -> has an array of IPrice that match the Member's plan-type
	 * 
	 * @param date:	number	An optional as-at date to determine rows in an effective date-range
	 * @param uid:	string	An optional User UID (defaults to current logged-on User)
	 */
	getMemberData(date?: TDate, uid?: string): Observable<IMemberState> {
		const filterProfile = [
			addWhere(FIELD.type, ['plan', 'info', 'pref']),   // where the <type> is either 'plan', 'info', or 'pref'
			addWhere(FIELD.uid, uid || '{{auth.user.uid}}'),  // and the <uid> is provided or the getAuthData()'s 'auth.user.uid'
		]
		const filterPrice = addWhere(FIELD.key, '{{member.plan[0].plan}}');
		const filterMessage = addWhere(FIELD.type, 'alert');

		return this.getAuthData().pipe(
			joinDoc(this.states, 'default', STORE.default, undefined, date),
			joinDoc(this.states, 'member', STORE.profile, filterProfile, date),
			joinDoc(this.states, 'member', STORE.price, filterPrice, date),
			joinDoc(this.states, 'member.message', STORE.message, filterMessage, date),
		)
	}

	/**
	 * Add current Plan[] and Price[] to the Member Profile Observable  
	 * client.plan  -> has an array of asAt Plan documents  
	 * client.price -> has an array of asAt Price documents
	 */
	getPlanData(date?: TDate, uid?: string): Observable<IPlanState> {
		return this.getMemberData(date, uid).pipe(
			joinDoc(this.states, 'client', STORE.plan, undefined, date),
			joinDoc(this.states, 'client', STORE.price, undefined, date),
			map(table => buildPlan(table)),
		)
	}

	/**
	 * Add Account details to the Member Profile Observable  
	 * account.payment-> has an array of open (not asAt) details about the Member's account payments  
	 * account.attend	-> has an array of attendances against the <active> payment  
	 * account.summary-> has an object summarising the Member's account value as { pay: $, bank: $, pend: $, cost: $ }
	 */
	getAccountData(uid?: string, date?: TDate): Observable<IAccountState> {
		const filterPayment = addWhere(FIELD.uid, uid || '{{auth.user.uid}}');
		const filterAttend = addWhere('payment', `{{account.payment[0].${FIELD.id}}}`);

		return this.getAttendData(uid).pipe(
			combineLatest(this.getMemberData(date, uid)),
			map(([_AttendState, MemberState]) => MemberState),
			joinDoc(this.states, 'account.payment', STORE.payment, filterPayment, undefined, sumPayment),
			joinDoc(this.states, 'account.attend', STORE.attend, filterAttend, undefined, sumAttend),
		)

		// return this.getMemberData(date, uid).pipe(												// watch for /member changes
		// 	combineLatest(this.getAttendData(uid)),													// make sure we watch for /attend changes too
		// 	map(([MemberState, _AttendState]) => MemberState),							// forward only the MemberState
		// 	joinDoc(this.states, 'account.payment', STORE.payment, filterPayment, undefined, sumPayment),
		// 	joinDoc(this.states, 'account.attend', STORE.attend, filterAttend, undefined, sumAttend),
		// )
	}

	//TODO: apply bonus-pricing to client.schedule
	/**
	 * Assemble an Object describing the Timetable for a specified date, as , where keys are:  
	 * schedule   -> has an array of Schedule info for the weekday of the supplied date  
	 * calendar		-> has the Calendar event for that date (to override regular class)  
	 * event			-> has the Events that are indicated on that calendar
	 * class      -> has the Classes that are available on that schedule or event  
	 * location   -> has the Locations that are indicated on that schedule or calendar
	 * instructor -> has the Instructors that are indicated on that schedule or calendar
	 * span				-> has the Class Duration definitions ('full' or 'half')
	 * alert			-> has an array of Alert notes to display on the Attend component
	 */
	getScheduleData(date?: TDate, uid?: string) {
		const base = getDate(date);
		const filterSchedule = addWhere('day', base.format(DATE_FMT.weekDay));
		const filterCalendar = addWhere(FIELD.key, base.format(DATE_FMT.yearMonthDay));
		const filterEvent = addWhere(FIELD.key, `{{client.calendar.${FIELD.type}}}`);
		const filterTypeClass = addWhere(FIELD.key, `{{client.schedule.${FIELD.key}}}`);
		const filterTypeEvent = addWhere(FIELD.key, `{{client.event.classes}}`);
		const filterLocation = addWhere(FIELD.key, ['{{client.schedule.location}}', '{{client.calendar.location}}']);
		const filterInstructor = addWhere(FIELD.key, ['{{client.schedule.instructor}}', '{{client.calendar.instructor}}']);
		const filterAlert = [
			addWhere(FIELD.type, STORE.schedule),
			addWhere('location', ['{{client.schedule.location}}', '{{client.calendar.location}}']),
		]
		const filterRange = [
			addWhere(FIELD.effect, Number.MIN_SAFE_INTEGER, '>'),
			addWhere(FIELD.expire, Number.MAX_SAFE_INTEGER, '<'),
		]

		return this.getMemberData(date, uid).pipe(
			joinDoc(this.states, 'client', STORE.schedule, filterSchedule, date),								// whats on this weekday
			joinDoc(this.states, 'client', STORE.calendar, filterCalendar, date, calendarDay),	// get calendar for this date
			joinDoc(this.states, 'client', STORE.calendar, filterRange, date),									// get any blocked calendar-range
			joinDoc(this.states, 'client', STORE.event, filterEvent, date),											// get event for this calendar-date
			joinDoc(this.states, 'client', STORE.class, filterTypeClass, date),									// get classes for this weekday
			joinDoc(this.states, 'client', STORE.class, filterTypeEvent, date),									// get classes for this calendar-date
			joinDoc(this.states, 'client', STORE.location, filterLocation, date),								// get location for this timetable
			joinDoc(this.states, 'client', STORE.instructor, filterInstructor, date),						// get instructor for this timetable
			joinDoc(this.states, 'client', STORE.span, undefined, date),												// get class durations
			joinDoc(this.states, 'client', STORE.alert, filterAlert, date),											// get any Alert message for this date
			map(table => buildTimetable(table)),																								// assemble the Timetable
		) as Observable<ITimetableState>																											// declaire Type (to override pipe()'s limit of nine)
	}

	/**
	 * Assemble a standalone Object describing the Schedule for the week (Mon-Sun) that matches the supplied date.  
	 * It will take the ITimetable format (described in getTimetableData)
	 */
	getTimetableData(date?: TDate): Observable<ITimetableState> {
		const base = getDate(date);
		const filterClass = addWhere(FIELD.key, `{{client.schedule.${FIELD.key}}}`);
		const filterLocation = addWhere(FIELD.key, '{{client.schedule.location}}');
		const filterCalendar = [
			addWhere(FIELD.key, base.startOf('week').format(DATE_FMT.yearMonthDay), '>='),
			addWhere(FIELD.key, base.endOf('week').format(DATE_FMT.yearMonthDay), '<='),
		]
		const filterEvent = addWhere(FIELD.key, `{{client.calendar.${FIELD.type}}}`);

		return of({}).pipe(																						// start with an empty Object
			joinDoc(this.states, 'default', STORE.default, undefined, date),
			joinDoc(this.states, 'client', STORE.schedule, undefined, date),
			joinDoc(this.states, 'client', STORE.class, filterClass, date),
			joinDoc(this.states, 'client', STORE.location, filterLocation, date),
			joinDoc(this.states, 'client', STORE.calendar, filterCalendar, date, calendarDay),
			joinDoc(this.states, 'client', STORE.event, filterEvent, date),
			take(1),
		)
	}
}