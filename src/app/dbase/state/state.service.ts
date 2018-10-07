import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Select } from '@ngxs/store';

import { IAuthState } from '@dbase/state/auth.define';
import { IFireClaims } from '@dbase/auth/auth.interface';
import { IStoreState } from '@dbase/state/store.define';
import { getUser, IMemberState, IUserState, IPlanState, ITimetableState, joinDoc, getStore, IState } from '@dbase/state/state.library';

import { DBaseModule } from '@dbase/dbase.module';
import { STORE, FIELD } from '@dbase/data/data.define';
import { TWhere } from '@dbase/fire/fire.interface';

import { asArray } from '@lib/array.library';
import { fmtDate } from '@lib/date.library';
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
    this.states = {                   // a Lookup map for Slice to State
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
    const filterPrice: TWhere = { fieldPath: FIELD.key, value: '{{member.plan[0].plan}}' };
    const filterProfile: TWhere = [
      { fieldPath: FIELD.type, value: ['plan', 'info'] },           // where the <type> is either 'plan' or 'info'
      { fieldPath: FIELD.key, value: uid || '{{auth.user.uid}}' },  // and the <key> is the getUserData()'s 'auth.user.uid'
    ]
    const filterAccount: TWhere = [
      { fieldPath: FIELD.type, value: ['topUp'] },
      { fieldPath: FIELD.key, value: uid || '{{auth.user.uid}}' },  // and the <key> is the getUserData()'s 'auth.user.uid'
    ]

    return this.getUserData(uid).pipe(
      joinDoc(this.states, 'default', STORE.default, undefined, date),
      joinDoc(this.states, 'member', STORE.profile, filterProfile, date),
      joinDoc(this.states, 'member', STORE.price, filterPrice, date),
      joinDoc(this.states, 'member', STORE.account, filterAccount, date),
    )
  }

  /** Add current Plan[] and Price[] to the Member Profile Observable  
   * client.plan  -> has an array of asAt Plan documents  
   * client.price -> has current(not asAt) details about the Member's account as {pay: $, bank: $, pend: $, cost: $, active: <accountId>}  
   */
  getPlanData(date?: number, uid?: string): Observable<IPlanState> {
    return this.getMemberData(date, uid).pipe(
      joinDoc(this.states, 'client', STORE.plan, undefined, date),
      joinDoc(this.states, 'client', STORE.price, undefined, date),
    )
  }

  /**
   * Assemble an Object describing the specified date's values, as {schedule: {}, class: {}, location: {}, instructor: {}}, where:
   * schedule   -> has an array of Schedule items that are active on the weekday of the supplied date
   * class      -> has the Classes that are available on that schedule
   * location   -> has the Locations that are indicated on that schedule
   * instructor -> has the Instructors that are indicated on that schedule
   */
  getTimetableData(date?: number, uid?: string): Observable<ITimetableState> {
    const filterSchedule: TWhere = { fieldPath: 'day', value: fmtDate('weekDay', date) };
    const filterClass: TWhere = { fieldPath: FIELD.key, value: `{{client.schedule.${FIELD.key}}}` };
    const filterLocation: TWhere = { fieldPath: FIELD.key, value: '{{client.schedule.location}}' };
    const filterInstructor: TWhere = { fieldPath: FIELD.key, value: '{{client.schedule.instructor}}' };

    return this.getMemberData(date, uid).pipe(
      joinDoc(this.states, 'client', STORE.schedule, filterSchedule, date),
      joinDoc(this.states, 'client', STORE.class, filterClass, date),
      joinDoc(this.states, 'client', STORE.location, filterLocation, date),
      joinDoc(this.states, 'client', STORE.instructor, filterInstructor, date),
    )
  }
}