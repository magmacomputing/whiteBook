import { Injectable } from '@angular/core';
import { IdTokenResult, UserInfo } from '@firebase/auth-types';
import { Observable } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

import { Store, Select } from '@ngxs/store';
import { IAuthState } from '@dbase/state/auth.define';
import { IStoreState } from '@dbase/state/store.define';

import { DBaseModule } from '@dbase/dbase.module';
import { TTokenClaims } from '@dbase/auth/auth.interface';
import { IProfilePlan, IPrice } from '@dbase/data/data.schema';
import { STORE, FIELD } from '@dbase/data/data.define';

import { asAt } from '@dbase/app/app.library';
import { dbg } from '@lib/logger.library';

/**
 * DBaseService is a helper-class that will perform 'Joins' between various Store-documents
 */
@Injectable({ providedIn: DBaseModule })
export class DBaseService {
  @Select() auth$!: Observable<IAuthState>;
  @Select() client$!: Observable<IStoreState>;
  @Select() member$!: Observable<IStoreState>;
  @Select() attend$!: Observable<IStoreState>;

  private dbg: Function = dbg.bind(this);

  constructor(private readonly store: Store) { }

  /**
   * Assemble an Object describing a Member, returned as {user: {}, plan: {}, price: {}, account: {}}, where:  
   * user   -> has general details about the User {displayName, email, photoURL, providerId, uid, claims}  
   * plan   -> has the asAt ProfilePlan document, for the user.uid  
   * price  -> has an array of asAt Price documents that relate to plan.key  
   * account-> has current (not asAt) details about the Member's account as {pay: $, bank: $, pend: $, cost: $, active: <accountId>}  
   * 
   * @param uid:	string	An optional User UID (defaults to current logged-on User)
   * @param date:	number	An optional as-at date to determine rows in an effective date-range
   */
  getMemberData(uid?: string, date?: number) {
    return this.auth$.pipe(
      map(auth => ({ ...auth.userInfo, ...(auth.userToken as IdTokenResult).claims })),// get the current User
      map((user: UserInfo & TTokenClaims) => {
        const { displayName, email, photoURL, providerId, uid, claims } = user;
        return { displayName, email, photoURL, providerId, uid, claims }
      }),
      switchMap(user => this.member$.pipe(                   // search the /member store for an effective ProfilePlan
        map((state: IStoreState) => asAt<IProfilePlan>(state[STORE.profile] as IProfilePlan[],
          [{ fieldPath: FIELD.type, value: 'plan' }, { fieldPath: FIELD.key, value: user.uid }], date)),
        map(table => Object.assign({}, { user }, { plan: table[0] }),// return only the first occurrence
        )),
      ),
      switchMap((result: any) => this.client$.pipe(         // get the prices[] for the effective ProfilePlan
        map((state: IStoreState) => asAt<IPrice>(state[STORE.price] as IPrice[],
          [{ fieldPath: FIELD.key, value: result.plan.plan }], date)),
        map(table => Object.assign({}, result, { price: table })),
      )),
    )
  }
}
