import { Injectable } from '@angular/core';
import { IdTokenResult, UserInfo } from '@firebase/auth-types';
import { Observable } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';

import { Select } from '@ngxs/store';
import { IAuthState } from '@dbase/state/auth.define';
import { IStoreState } from '@dbase/state/store.define';

import { TWhere } from '@dbase/fire/fire.interface';
import { DBaseModule } from '@dbase/dbase.module';
import { TTokenClaims } from '@dbase/auth/auth.interface';
import { IProfilePlan, IPrice, IDefault, ISchedule, ILocation, IClass, IPlan, IAccount, IProfileUser } from '@dbase/data/data.schema';
import { STORE, FIELD } from '@dbase/data/data.define';

import { asAt } from '@dbase/app/app.library';
import { fmtDate } from '@lib/date.library';
import { asSet } from '@lib/array.library';
import { sortKeys } from '@lib/object.library';
import { dbg } from '@lib/logger.library';

export interface IProfileState {
  user: UserInfo & TTokenClaims;
  member: {
    plan: IProfilePlan;
    info: IProfileUser[];
  }
  defaults: IDefault[];
  account?: IAccount[];
}
export interface IPlanState extends IProfileState {
  plan: IPlan[];
  price: IPrice[];
}

/**
 * StateService will wire-up Observables on the NGXS Store.  
 * It also has helper-methods to perform 'Joins' between various Store-documents
 */
@Injectable({ providedIn: DBaseModule })
export class StateService {
  @Select() private auth$!: Observable<IAuthState>;
  @Select() private client$!: Observable<IStoreState<any>>;
  @Select() private member$!: Observable<IStoreState<any>>;
  @Select() private attend$!: Observable<IStoreState<any>>;

  private dbg: Function = dbg.bind(this);

  constructor() { }

  /** Get the project defaults Store, and arrange into an Object keyed by the <type> */
  getDefaults(date?: number) {
    const result: { [key: string]: IDefault } = {};

    return this.client$.pipe(
      map(state => asAt<IDefault>(state[STORE.default], undefined, date)),
      map(table => table.forEach(row => result[row[FIELD.type]] = row)),
      map(_ => result),
    )
  }

  /** Generic Slice Observable */
  private getStore<T>(slice: Observable<IStoreState<T>>, store: string, filter: TWhere = [], date?: number) {
    return slice.pipe(
      map(state => asAt<T>(state[store], filter, date)),
    )
  }

  /**
   * Assemble an Object describing a Member, returned as {user: {}, member: {}, price: {}, account: {}}, where:  
   * user   -> has general details about the User {displayName, email, photoURL, providerId, uid, claims}  
   * memberPlan -> has the asAt ProfilePlan for the user.uid
   * memberInfo -> has the additionalUserInfo ProfileUser documents, for the user.uid  
   * 
   * @param date:	number	An optional as-at date to determine rows in an effective date-range
   * @param uid:	string	An optional User UID (defaults to current logged-on User)
   */
  getMemberData(date?: number, uid?: string): Observable<IProfileState> {
    return this.auth$.pipe(
      map(auth => ({ ...auth.userInfo, ...(auth.userToken as IdTokenResult).claims })),// get the current User
      map((user: UserInfo & TTokenClaims) => ({ user: { displayName: user.displayName, email: user.email, photoURL: user.photoURL, providerId: user.providerId, uid: user.uid, claims: user.claims } })),

      switchMap(result => this.getDefaults().pipe(              // inject the /client/_default_ store for current values
        map(defaults => Object.assign(result, { defaults })),
      )),

      switchMap(result => this.member$.pipe(                    // search the /member store for the effective ProfilePlan
        map(state => asAt<IProfilePlan | IProfileUser>(state[STORE.profile],
          [{ fieldPath: FIELD.type, value: ['plan', 'user'] }, { fieldPath: FIELD.key, value: result.user.uid }], date)),
        map(table => Object.assign(result, {
          member: {
            plan: table.filter(row => row[FIELD.type] === 'plan')[0],
            info: table.filter(row => row[FIELD.type] === 'user')
          }
        }),
        )),
      ),

      // switchMap(result => this.client$.pipe(                    // get the prices[] for the effective ProfilePlan
      //   map(state => asAt<IPrice>(state[STORE.price],
      //     [{ fieldPath: FIELD.key, value: result.plan.plan }], date)),
      //   map(table => Object.assign(result, { price: table })),
      // )),
    )
  }

  /** Add current Plan and Price to the Member Profile Observable
   * price  -> has an array of asAt Price documents that relate to member.plan.key
   * account-> has current(not asAt) details about the Member's account as {pay: $, bank: $, pend: $, cost: $, active: <accountId>}  
  */
  getPlanData(date?: number, uid?: string): Observable<IPlanState> {
    return this.getMemberData(date, uid).pipe(
      switchMap(result => this.getStore<IPlan>(this.client$, STORE.plan).pipe(
        map(table => Object.assign(result, { plan: table.sort(sortKeys('sort', FIELD.key)) })),
      )),

      switchMap(result => this.getStore<IPrice>(this.client$, STORE.price).pipe(
        map(table => table.filter(row => row[FIELD.key] === result.member.plan.plan)),
        map(table => Object.assign(result, { price: table })),
      )),
    )
  }

  /**
   * Assemble an Object describing the specified day's values, as {schedule: {}, member: {}, class: {}}, where:
   * schedule  -> 
   * member    -> has the Member-specific data (uid, plan, price[], account)
   * class     -> has the Class-span (to use when determining pricing)
   */
  getScheduleData(date?: number, uid?: string) {
    return this.client$.pipe(                                   // get the items on todays schedule
      map((state: IStoreState<ISchedule>) => asAt(state[STORE.schedule],
        { fieldPath: 'day', value: fmtDate(date).weekDay }, date)),

      map(table => table.map(row => this.client$.pipe( // get the Class store for this item
        map((state: IStoreState<IClass>) => asAt(state[STORE.class],
          { fieldPath: FIELD.key, value: row[FIELD.key] }, date)),
        map(table => Object.assign(row, { class: table[0] })),

        switchMap(result => this.client$.pipe(                  // get the Price store for this item
          map((state: IStoreState<IPrice>) => asAt(state[STORE.price],
            [{ fieldPath: FIELD.key, value: 'member' }, { fieldPath: FIELD.type, value: result.class[FIELD.type] }],
            date)),
          map(table => Object.assign(result, { price: table[0] })),
        )),
      ))),
      map(table => ({ schedule: table.sort(sortKeys(['start'])) })),

      // map(result => Object.assign(result, { location: arrayUnique(result.schedule.map(row => row.location))) })),
      // switchMap(result => this.client$.pipe(
      //   map((state: IStoreState<ILocation>) => asAt(state[STORE.location],
      //     { fieldPath: FIELD.key, value: result.location }, date)),
      //   map(table => Object.assign(result, { location: table })),
      // )),
    )
  }
}