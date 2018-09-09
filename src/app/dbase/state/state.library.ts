import { Observable, defer, combineLatest } from 'rxjs';
import { switchMap, map, tap } from 'rxjs/operators';

import { IStoreState, IStoreDoc } from '@dbase/state/store.define';
import { TWhere } from '@dbase/fire.interface';
import { TTokenClaims, IFireClaims } from '@dbase/auth/auth.interface';
import { IProfilePlan, IProfileInfo, IDefault, IPlan, IPrice, IAccount, IStoreBase } from '@dbase/data.schema';

import { asAt } from '@dbase/app/app.library';
import { getPath, cloneObj } from '@lib/object.library';
import { asArray } from '@lib/array.library';
import { isString } from '@lib/type.library';

export interface IUserState {
  auth: {
    user: {                             // generic information returned from a Provider
      uid: string;
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoURL: string | null;
    } | null;
    claims: TTokenClaims | null;        // authenticated customClaims
  }
}

export interface IProfileState extends IUserState {
  member: {
    plan?: IProfilePlan;                // member's effective plan
    info?: IProfileInfo[];              // array of AdditionalUserInfo documents
    account?: IAccount[];               // array of active payment documents
  }
  defaults?: IDefault[];                // defaults to apply, if missing from Member data
}

export interface IPlanState extends IProfileState {
  client: {
    plan: IPlan[];                      // array of effective Plan documents
    price: IPrice[];                    // array of effective Price documents
  }
}

/** extract the required fields from the AuthToken object */
export const getUser = (token: IFireClaims) =>
  ({ displayName: token.name, email: token.email, photoURL: token.picture, providerId: token.firebase.sign_in_provider, uid: token.user_id });


/** Generic Slice Observable */
export const getStore = <T>(slice: Observable<IStoreState<T>>, store: string, filter: TWhere = [], date?: number) =>
  slice.pipe(
    map(state => asAt<T>(state[store], filter, date)),
  )

/**
 * Join a Parent document to other documents referenced a supplied string of key fields  
 * slice:   a section of the State (eg. member$) which contains the to-be-referenced documents  
 * store:   the documents in the State with the supplied <store> field  
 * filter:  the Where-criteria to narrow down the document list  
 * date:    the as-at Date, to determine which documents are in the effective-range.
 */
export const joinDoc = <T>(slice: Observable<IStoreState<T>>, store: string, filter: TWhere = [], date?: number) => {
  return (source: Observable<any>) => defer(() => {
    let parent: any;

    return source.pipe(
      switchMap(data => {
        parent = data;                                        // stash the original parent data state

        const criteria = asArray(cloneObj(filter)).map(cond => {
          cond.value = asArray(cond.value).map(value =>       // loop through filter, checking each <value> clause
            isString(value) && value.substring(0, 2) === '{{' // check if is it a fieldPath reference on the source
              ? getPath(data, value.replace('{{', '').replace('}}', ''))
              : value
          );
          if (cond.value.length === 1) cond.value = cond.value[0];
          return cond;
        })

        return combineLatest(getStore(slice, store, criteria, date));
      }),

      map(res => {
        let joins: { [key: string]: any[] } = {};
        res.forEach(table => table.forEach((row: any) => {
          const type: string = row.type;                      // TODO: dont hardcode 'type'
          joins[type] = joins[type] || [];
          joins[type].push(row);
        }))
        return { ...parent, ...{ member: joins } }            // TODO: dont hardcode 'member'
      })
    )
  })
}