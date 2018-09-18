import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';

import { Select, Store } from '@ngxs/store';
import { IAuthState } from '@dbase/state/auth.define';
import { IFireClaims } from '@dbase/auth/auth.interface';
import { IStoreState } from '@dbase/state/store.define';
import { IPlanState, getUser, IProfileState, IUserState, joinDoc, getStore, IState, IAttendState } from '@dbase/state/state.library';

import { DBaseModule } from '@dbase/dbase.module';
import { IPrice, IDefault, ISchedule, IClass, IPlan } from '@dbase/data/data.schema';
import { STORE, FIELD } from '@dbase/data/data.define';
import { TWhere } from '@dbase/fire/fire.interface';

import { asArray } from '@lib/array.library';
import { fmtDate } from '@lib/date.library';
import { sortKeys } from '@lib/object.library';
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

  constructor(private store: Store) {
    this.states = {                   // a Lookup map for Slice to State
      'auth': this.auth$,
      'client': this.client$,
      'member': this.member$,
      'attend': this.attend$,
      'admin': this.admin$,
    }
  }

  /** Fetch the current, useable values for a supplied store */
  getCurrent<T>(store: string, filter?: TWhere, sortBy: string | string[] = []) {
    const filters = asArray(filter);
    filters.push({ fieldPath: FIELD.expire, value: 0 });
    filters.push({ fieldPath: FIELD.hidden, value: false });

    return getStore<T>(this.states, store, filters).pipe(
      map(table => table.sort(sortKeys(...asArray(sortBy)))),			// apply any requested sort-criteria)
    )
  }

  /** Get the project defaults Store, and arrange into an Object keyed by the <type> */
  getDefaults(date?: number) {
    const result: { [key: string]: IDefault } = {};

    return getStore<IDefault>(this.states, STORE.default).pipe(
      map(table => table.forEach(row => result[row[FIELD.type]] = row)),
      map(_ => result),
    )
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
   * Extend UserState with an Object describing a Member returned as IProfileState, where:  
   * member.plan  -> has the asAt ProfilePlan for the user.uid  
   * member.info  -> has the additionalUserInfo ProfileUser documents for the user.uid  
   * member.price -> has an array of IPrice that match the Member's plan-type
   * 
   * @param date:	number	An optional as-at date to determine rows in an effective date-range
   * @param uid:	string	An optional User UID (defaults to current logged-on User)
   */
  getMemberData(date?: number, uid?: string): Observable<IProfileState> {
    const filterPrice: TWhere = { fieldPath: FIELD.key, value: '{{member.plan[0].plan}}' };
    const filterProfile: TWhere = [
      { fieldPath: FIELD.type, value: ['plan', 'info'] },           // where the <type> is either 'plan' or 'info'
      { fieldPath: FIELD.key, value: uid || '{{auth.user.uid}}' },  // and the <key> is the getUserData()'s 'auth.user.uid'
    ]

    return this.getUserData(uid).pipe(
      joinDoc(this.states, 'member', STORE.profile, filterProfile, date),
      joinDoc(this.states, 'member', STORE.price, filterPrice, date),
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
   * Assemble an Object describing the specified day's values, as {schedule: {}, member: {}, class: {}}, where:
   * schedule  -> 
   * class     -> has the Class-span (to use when determining pricing)
   */
  getScheduleData(date?: number, uid?: string): Observable<IAttendState> {
    date = fmtDate('2018-09-16').milliSecond;
    const filterSchedule: TWhere = { fieldPath: 'day', value: fmtDate(date).weekDay };
    const filterClass: TWhere = { fieldPath: FIELD.key, value: `client.schedule[*].${FIELD.key}` }
    this.dbg('weekDay: %s', fmtDate(date).weekDay);
    return this.getMemberData(date, uid).pipe(
      joinDoc(this.states, 'client', STORE.schedule, filterSchedule, date),
      tap(res => this.dbg('today: %s, %j', new Date((date as number) * 1000).toLocaleDateString(), res.client.schedule.map((row: any) => row[FIELD.key]))),
      joinDoc(this.states, 'client', STORE.class, filterClass, date),
      tap(res => this.dbg('classes: %j', res.client.class)),
      // joinDoc(this.states, 'client', STORE.location, undefined, date),
      // joinDoc(this.states, 'client', STORE.instructor, undefined, date),
      // return getStore<ISchedule>(this.states, STORE.schedule, filterSchedule, date).pipe( // get the items on todays schedule
      // map((state: IStoreState<ISchedule>) => asAt(state[STORE.schedule],
      //   { fieldPath: 'day', value: fmtDate(date).weekDay }, date)),

      // map(table => table.map(row => this.client$.pipe( // get the Class store for this item
      //   map((state: IStoreState<IClass>) => asAt(state[STORE.class],
      //     { fieldPath: FIELD.key, value: row[FIELD.key] }, date)),
      //   map(table => Object.assign(row, { class: table[0] })),

      //   switchMap(result => this.client$.pipe(                  // get the Price store for this item
      //     map((state: IStoreState<IPrice>) => asAt(state[STORE.price],
      //       [{ fieldPath: FIELD.key, value: 'member' }, { fieldPath: FIELD.type, value: result.class[FIELD.type] }],
      //       date)),
      //     map(table => Object.assign(result, { price: table[0] })),
      //   )),
      // ))),
      // map(table => ({ schedule: table.sort(sortKeys(['start'])) })),

      // map(result => Object.assign(result, { location: arrayUnique(result.schedule.map(row => row.location))) })),
      // switchMap(result => this.client$.pipe(
      //   map((state: IStoreState<ILocation>) => asAt(state[STORE.location],
      //     { fieldPath: FIELD.key, value: result.location }, date)),
      //   map(table => Object.assign(result, { location: table })),
      // )),
    )
  }
}