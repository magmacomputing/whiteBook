import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { Select } from '@ngxs/store';

import { IFireClaims } from '@dbase/auth/auth.interface';
import { IAuthState } from '@dbase/state/auth.define';
import { IStoreState } from '@dbase/state/store.define';
import { IMemberState, IUserState, IPlanState, ITimetableState, IState, IAccountState } from '@dbase/state/state.define';
import { getUser, joinDoc, getStore, sumPayment, sumAttend } from '@dbase/state/state.library';

import { DBaseModule } from '@dbase/dbase.module';
import { TWhere, IWhere } from '@dbase/fire/fire.interface';
import { STORE, FIELD } from '@dbase/data/data.define';

import { asArray } from '@lib/array.library';
import { fmtDate, getMoment } from '@lib/date.library';
import { dbg } from '@lib/logger.library';

/**
 * StateService will wire-up Observables on the NGXS Store.  
 * It also has helper-methods to perform 'Joins' between related Store-documents
 */
@Injectable({ providedIn: DBaseModule })
export class StateService {
	@Select() private auth$!: Observable<IAuthState>;
	@Select() private client$!: Observable<IStoreState<any>>;
	@Select() private member$!: Observable<IStoreState<any>>;
	@Select() private attend$!: Observable<IStoreState<any>>;
	@Select() private admin$!: Observable<IStoreState<any>>;

	private dbg: Function = dbg.bind(this);
	public states: IState;

	constructor() {
		this.states = {                   // a Lookup map for Slice-to-State
			'auth': this.auth$,
			'client': this.client$,
			'member': this.member$,
			'attend': this.attend$,
			'admin': this.admin$,
		}
	}

	/** Fetch the current, useable values for a supplied store */
	getCurrent<T>(store: string, filter?: TWhere) {
		const filters = asArray(filter);
		filters.push({ fieldPath: FIELD.expire, value: 0 });
		filters.push({ fieldPath: FIELD.hidden, value: false });

		return getStore<T>(this.states, store, filters);
	}

  /**
  * Assemble a UserState Object describing a User, where:  
  * auth.user    -> has Firebase details about the User Account  
  * auth.claims  -> has authenticated customClaims
  */
	getUserData(uid?: string): Observable<IUserState> {               // TODO: allow for optional <uid> parameter to resolve in admin$ state
		return this.auth$.pipe(
			map(auth => auth.token),
			map(token => {
				return token && token.claims
					? { auth: { user: getUser(token.claims as IFireClaims), claims: token.claims.claims } }
					: { auth: { user: null, claims: null } }
			})
		)
	}

  /**
   * Extend UserState with an Object describing a Member returned as IMemberState, where:  
   * member.plan  -> has the asAt ProfilePlan for the user.uid  
   * member.info  -> has the additionalUserInfo ProfileUser documents for the user.uid  
   * member.price -> has an array of IPrice that match the Member's plan-type
   * default._default_ -> has an array of IDefault values
   * 
   * @param date:	number	An optional as-at date to determine rows in an effective date-range
   * @param uid:	string	An optional User UID (defaults to current logged-on User)
   */
	getMemberData(date?: number, uid?: string): Observable<IMemberState> {
		const filterProfile: TWhere = [
			{ fieldPath: FIELD.type, value: ['plan', 'info'] },           // where the <type> is either 'plan' or 'info'
			{ fieldPath: FIELD.uid, value: uid || '{{auth.user.uid}}' },  // and the <uid> is the getUserData()'s 'auth.user.uid'
		]
		const filterPrice: TWhere = { fieldPath: FIELD.key, value: '{{member.plan[0].plan}}' };

		return this.getUserData(uid).pipe(
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
	 * account.payment-> has an array of current (not asAt) details about the Member's account payments  
	 * account.active	-> has an array of payments ids that are <active> (only 1 expected)  
	 * account.attend	-> has an array of attendances against the <active> payment  
	 * account.summary-> has an object summarising the Member's account value as { pay: $, bank: $, pend: $, cost: $, active: paymentId[] }
	 */
	getAccountData(uid?: string): Observable<IAccountState> {
		const filterPayment: IWhere = { fieldPath: FIELD.uid, value: uid || '{{auth.user.uid}}' };
		const filterAttend: IWhere = { fieldPath: 'payment', value: '{{account.active}}' };

		return this.getMemberData().pipe(
			joinDoc(this.states, 'account.payment', STORE.payment, filterPayment, undefined, sumPayment),
			joinDoc(this.states, 'account', STORE.attend, filterAttend, undefined, sumAttend),
		)
	}

  /**
   * Assemble an Object describing the Timetable for a specified date, as , where keys are:  
   * schedule   -> has an array of Schedule info for the weekday of the supplied date  
   * class      -> has the Classes that are available on that schedule  
	 * calendar		-> has the Calendar event for that date (to override regular class)  
	 * event			-> has the Events that are indicated on that calendar
   * location   -> has the Locations that are indicated on that schedule  
   * instructor -> has the Instructors that are indicated on that schedule
   */
	getTimetableData(date?: number, uid?: string): Observable<ITimetableState> {
		const filterSchedule: TWhere = { fieldPath: 'day', value: fmtDate('weekDay', date) };
		const filterCalendar: TWhere = { fieldPath: FIELD.key, value: fmtDate('yearMonthDay', date) };
		const filterEvent: TWhere = { fieldPath: FIELD.key, value: `{{client.calendar.${FIELD.type}}}` };
		const filterClass: TWhere = { fieldPath: FIELD.key, value: `{{client.schedule.${FIELD.key}}}` };
		const filterLocation: TWhere = { fieldPath: FIELD.key, value: '{{client.schedule.location}}' };
		const filterInstructor: TWhere = { fieldPath: FIELD.key, value: '{{client.schedule.instructor}}' };

		return this.getMemberData(date, uid).pipe(
			joinDoc(this.states, 'client', STORE.schedule, filterSchedule, date),
			joinDoc(this.states, 'client', STORE.class, filterClass, date),
			joinDoc(this.states, 'client', STORE.calendar, filterCalendar, date),
			joinDoc(this.states, 'client', STORE.event, filterEvent, date),
			joinDoc(this.states, 'client', STORE.location, filterLocation, date),
			joinDoc(this.states, 'client', STORE.instructor, filterInstructor, date),
		)
	}

  /**
   * Assemble an standalone Object describing the Schedule for the week (Mon-Sun) that matches the supplied date.  
	 * It will take the ITimetable format (described in getTimetableData)
   */
	getScheduleData(date?: number): Observable<ITimetableState> {
		const moment = getMoment(date);
		const filterCalendar: TWhere = [
			{ fieldPath: FIELD.key, opStr: '>=', value: fmtDate('yearMonthDay', moment.startOf('week')) },
			{ fieldPath: FIELD.key, opStr: '<=', value: fmtDate('yearMonthDay', moment.endOf('week')) },
		]
		const filterEvent: TWhere = { fieldPath: FIELD.key, value: `{{client.calendar.${FIELD.type}}}` };
		const filterClass: TWhere = { fieldPath: FIELD.key, value: `{{client.schedule.${FIELD.key}}}` };
		const filterLocation: TWhere = { fieldPath: FIELD.key, value: '{{client.schedule.location}}' };
		const filterInstructor: TWhere = { fieldPath: FIELD.key, value: '{{client.schedule.instructor}}' };

		return of({}).pipe(																						// start with an empty Object
			joinDoc(this.states, 'default', STORE.default, undefined, date),
			joinDoc(this.states, 'client', STORE.schedule, undefined, date),
			joinDoc(this.states, 'client', STORE.class, filterClass, date),
			joinDoc(this.states, 'client', STORE.calendar, filterCalendar, date),
			joinDoc(this.states, 'client', STORE.event, filterEvent, date),
			joinDoc(this.states, 'client', STORE.location, filterLocation, date),
			joinDoc(this.states, 'client', STORE.instructor, filterInstructor, date),
		)
	}
}