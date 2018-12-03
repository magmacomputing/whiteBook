import { Injectable } from '@angular/core';

import { Observable, of } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { Select } from '@ngxs/store';

import { IAuthState } from '@dbase/state/auth.define';
import { TStateSlice } from '@dbase/state/state.define';
import { IMemberState, IPlanState, ITimetableState, IState, IAccountState, IUserState } from '@dbase/state/state.define';
import { joinDoc, getStore, sumPayment, sumAttend, calendarDay } from '@dbase/state/state.library';

import { DBaseModule } from '@dbase/dbase.module';
import { STORE, FIELD } from '@dbase/data/data.define';
import { IStoreMeta, TStoreBase } from '@dbase/data/data.schema';
import { TWhere, IWhere } from '@dbase/fire/fire.interface';

import { asArray } from '@lib/array.library';
import { fmtDate, getMoment, DATE_KEY } from '@lib/date.library';
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

	private dbg: Function = dbg.bind(this);
	public states: IState;

	constructor() {
		this.states = {                   // a Lookup map for State-to-Slice
			'client': this.client$,
			'member': this.member$,
			'attend': this.attend$,
			'admin': this.admin$,
			'local': this.local$,
		}
	}

	/** Fetch the current, useable values for a supplied store */
	getCurrent<T>(store: string, filter?: TWhere) {
		const filters = asArray(filter);
		filters.push({ fieldPath: FIELD.expire, value: 0 });
		filters.push({ fieldPath: FIELD.hidden, value: false });

		return getStore<T & TStoreBase>(this.states, store, filters);
	}

	/** Expose a library function */
	getSingle<T>(store: string, filter: TWhere) {
		return this.getCurrent<T>(store, filter)
			.pipe(
				take(1),											// only the first snapshot	
				map(table => table[0]),				// only the first element
			)
			.toPromise<T>();
	}

	/**
	* Assemble a AuthState Object describing a User
	*/
	getAuthData(): Observable<IUserState> {
		return this.auth$
			.pipe(map(auth => ({ auth })))
	}

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
	getMemberData(date?: number, uid?: string): Observable<IMemberState> {
		const filterPrice: TWhere = { fieldPath: FIELD.key, value: '{{member.plan[0].plan}}' };
		const filterProfile: TWhere = [
			{ fieldPath: FIELD.type, value: ['plan', 'info', 'pref'] },   // where the <type> is either 'plan', 'info', or 'pref'
			{ fieldPath: FIELD.uid, value: uid || '{{auth.user.uid}}' },  // and the <uid> is the getAuthData()'s 'auth.user.uid'
		]

		return this.getAuthData().pipe(
			joinDoc(this.states, 'default', STORE.default, undefined, date),
			joinDoc(this.states, 'member', STORE.profile, filterProfile, date),
			joinDoc(this.states, 'member', STORE.price, filterPrice, date),
		)
	}

	/**
	 * Add current Plan[] and Price[] to the Member Profile Observable  
	 * client.plan  -> has an array of asAt Plan documents  
	 * client.price -> has an array of asAt Price documents
	 */
	getPlanData(date?: number, uid?: string): Observable<IPlanState> {
		return this.getMemberData(date, uid).pipe(
			joinDoc(this.states, 'client', STORE.plan, undefined, date),
			joinDoc(this.states, 'client', STORE.price, undefined, date),
		)
	}

	/**
	 * Add Account details to the Member Profile Observable  
	 * account.payment-> has an array of open (not asAt) details about the Member's account payments  
	 * account.attend	-> has an array of attendances against the <active> payment  
	 * account.summary-> has an object summarising the Member's account value as { pay: $, bank: $, pend: $, cost: $ }
	 */
	getAccountData(uid?: string): Observable<IAccountState> {
		const filterPayment: IWhere = { fieldPath: FIELD.uid, value: uid || '{{auth.user.uid}}' };
		const filterAttend: IWhere = { fieldPath: 'payment', value: `{{account.payment[0].${FIELD.id}}}` };

		return this.getMemberData(undefined, uid).pipe(
			joinDoc(this.states, 'account.payment', STORE.payment, filterPayment, undefined, sumPayment),
			joinDoc(this.states, 'account.attend', STORE.attend, filterAttend, undefined, sumAttend),
		)
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
	 */
	getTimetableData(date?: number, uid?: string): Observable<ITimetableState> {
		const filterSchedule: TWhere = { fieldPath: 'day', value: fmtDate<number>(DATE_KEY.weekDay, date) };
		const filterCalendar: TWhere = { fieldPath: FIELD.key, value: fmtDate<number>(DATE_KEY.yearMonthDay, date) };
		const filterEvent: TWhere = { fieldPath: FIELD.key, value: `{{client.calendar.${FIELD.type}}}` };
		const filterClass: TWhere = { fieldPath: FIELD.key, value: `{{client.schedule.${FIELD.key}}}` };
		const filterSpecial: TWhere = { fieldPath: FIELD.key, value: `{{client.event.class}}` };
		const filterLocation: TWhere = { fieldPath: FIELD.key, value: ['{{client.schedule.location}}', '{{client.calendar.location}}'] };
		const filterInstructor: TWhere = { fieldPath: FIELD.key, value: ['{{client.schedule.instructor}}', '{{client.calendar.instructor}}'] };

		return this.getMemberData(date, uid).pipe(
			joinDoc(this.states, 'client', STORE.schedule, filterSchedule, date),								// whats on this weekday
			joinDoc(this.states, 'client', STORE.calendar, filterCalendar, date, calendarDay),	// get calendar for this date
			joinDoc(this.states, 'client', STORE.event, filterEvent, date),											// get event for this calendar-date
			joinDoc(this.states, 'client', STORE.class, filterClass, date),											// get classes for this weekday
			joinDoc(this.states, 'client', STORE.class, filterSpecial, date),										// get classes for this calendar-date
			joinDoc(this.states, 'client', STORE.location, filterLocation, date),								// get location for this timetable
			joinDoc(this.states, 'client', STORE.instructor, filterInstructor, date),						// get instructor for this timetable
		)
	}

	/**
	 * Assemble a standalone Object describing the Schedule for the week (Mon-Sun) that matches the supplied date.  
	 * It will take the ITimetable format (described in getTimetableData)
	 */
	getScheduleData(date?: number): Observable<ITimetableState> {
		const moment = getMoment(date);
		const filterClass: TWhere = { fieldPath: FIELD.key, value: `{{client.schedule.${FIELD.key}}}` };
		const filterLocation: TWhere = { fieldPath: FIELD.key, value: '{{client.schedule.location}}' };
		const filterInstructor: TWhere = { fieldPath: FIELD.key, value: '{{client.schedule.instructor}}' };

		const filterCalendar: TWhere = [
			{ fieldPath: FIELD.key, opStr: '>=', value: fmtDate<number>(DATE_KEY.yearMonthDay, moment.startOf('week')) },
			{ fieldPath: FIELD.key, opStr: '<=', value: fmtDate<number>(DATE_KEY.yearMonthDay, moment.endOf('week')) },
		]
		const filterEvent: TWhere = { fieldPath: FIELD.key, value: `{{client.calendar.${FIELD.type}}}` };

		return of({}).pipe(																						// start with an empty Object
			joinDoc(this.states, 'client', STORE.schedule, undefined, date),
			joinDoc(this.states, 'client', STORE.class, filterClass, date),
			joinDoc(this.states, 'client', STORE.location, filterLocation, date),
			joinDoc(this.states, 'client', STORE.instructor, filterInstructor, date),
			joinDoc(this.states, 'client', STORE.calendar, filterCalendar, date, calendarDay),
			joinDoc(this.states, 'client', STORE.event, filterEvent, date),
		)
	}
}