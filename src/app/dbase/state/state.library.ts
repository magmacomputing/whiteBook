import { Observable, defer, combineLatest } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';

import { TWhere } from '@dbase/fire/fire.interface';
import { TTokenClaims, IFireClaims } from '@dbase/auth/auth.interface';
import { IProfilePlan, IProfileInfo, IDefault, IPlan, IPrice, IAccount } from '@dbase/data/data.schema';

import { getPath } from '@lib/object.library';
import { asArray } from '@lib/array.library';
import { isString } from '@lib/type.library';
import { getSlice } from '@dbase/data/data.library';
import { asAt } from '@dbase/app/app.library';

export interface IState { [slice: string]: Observable<any> };

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

/** Generic Slice Observable */
export const getStore = <T>(states: IState, store: string, filter: TWhere = [], date?: number) => {
  const slice = getSlice(store);
  const state = states[slice];

  if (!state)
    throw new Error('Cannot resolve state from ' + store);

  return state.pipe(
    map(state => asAt<T>(state[store], filter, date)),
  )
}

/** extract the required fields from the AuthToken object */
export const getUser = (token: IFireClaims) =>
  ({ displayName: token.name, email: token.email, photoURL: token.picture, providerId: token.firebase.sign_in_provider, uid: token.user_id });

/**
 * Join a Parent document to other documents referenced a supplied string of key fields  
 * states:  an object of States (eg. member$) which contains the to-be-referenced documents
 * slice:   the name of the index (eg. 'member') where to place the documents on the State Object  
 * store:   the documents in the State with the supplied <store> field  
 * filter:  the Where-criteria to narrow down the document list  
 * date:    the as-at Date, to determine which documents are in the effective-range.
 */
export const joinDoc = <T>(states: IState, slice: string, store: string, filter: TWhere = [], date?: number) => {
  const state = getSlice(store);

  return (source: Observable<any>) => defer(() => {
    let parent: any;

    return source.pipe(
      switchMap(data => {
        parent = data;                                        // stash the original parent data state

        const filters = asArray(filter).map(cond => {
          cond.value = asArray(cond.value).map(value => {      // loop through filter, checking each <value> clause
            return isString(value) && value.substring(0, 2) === '{{' // check if is it a fieldPath reference on the source
              ? getPath(data, value.replace('{{', '').replace('}}', ''))
              : value
          });
          if (cond.value.length === 1) cond.value = cond.value[0];
          return cond;
        })
        return combineLatest(getStore(states, store, filters, date));
      }),

      map(res => {
        let joins: { [key: string]: any[] } = parent[slice] || {};
        res.forEach(table => table.forEach((row: any) => {
          const type: string = state === 'client' ? row.store : row.type;                      // TODO: dont hardcode 'type'
          joins[type] = joins[type] || [];
          joins[type].push(row);
        }))
        return { ...parent, ...{ [slice]: joins } }//, ...{ [slice]: parent[slice] } }
      })
    )
  })
}