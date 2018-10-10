import { Observable, defer, combineLatest } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';

import { TWhere } from '@dbase/fire/fire.interface';
import { TTokenClaims, IFireClaims } from '@dbase/auth/auth.interface';
import { asAt } from '@dbase/app/app.library';

import { IProfilePlan, IProfileInfo, IDefault, IPlan, IPrice, IAccount, ISchedule, IClass, IInstructor, ILocation, IEvent, ICalendar } from '@dbase/data/data.schema';
import { SORTBY, STORE, FIELD } from '@dbase/data/data.define';
import { getSlice } from '@dbase/data/data.library';

import { asArray } from '@lib/array.library';
import { getPath, sortKeys, cloneObj } from '@lib/object.library';
import { isString, isNull, isArray, isUndefined } from '@lib/type.library';

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

export interface IMemberState extends IUserState {
  member: {
    plan?: IProfilePlan[];              // member's effective plan
    price?: IPrice[];                   // member's effective prices
    info?: IProfileInfo[];              // array of AdditionalUserInfo documents
    account?: IAccount[];               // array of active payment documents
  }
  defaults?: IDefault[];                // defaults to apply, if missing from Member data
}

export interface IPlanState extends IMemberState {
  client: {
    plan: IPlan[];                      // array of effective Plan documents
    price: IPrice[];                    // array of effective Price documents
  }
}

export interface ITimetableState extends IMemberState {
  client: {
    schedule?: ISchedule[];
    class?: IClass[];
    event?: IEvent[];
    calendar?: ICalendar[];
    location?: ILocation[];
    instructor?: IInstructor[];
    price?: IPrice[];
  }
}

/** Generic Slice Observable */
export const getStore = <T>(states: IState, store: string, filter: TWhere = [], date?: number) => {
  const slice = getSlice(store);
  const state = states[slice];
  const sortBy = SORTBY[store];

  if (!state)
    throw new Error('Cannot resolve state from ' + store);

  return state.pipe(
    map(state => asAt<T>(state[store], filter, date)),
    map(table => table.sort(sortKeys(...asArray(sortBy)))),
  )
}

/** extract the required fields from the AuthToken object */
export const getUser = (token: IFireClaims) =>
  ({ displayName: token.name, email: token.email, photoURL: token.picture, providerId: token.firebase.sign_in_provider, uid: token.user_id });

/**
 * Join a Parent document to other documents referenced a supplied string of key fields  
 * states:  an object of States (eg. member$) which contains the to-be-referenced documents
 * index:   the name of the index (eg. 'member') under which we place the documents on the State Object  
 * store:   the documents in the State with the supplied <store> field  
 * filter:  the Where-criteria to narrow down the document list  
 * date:    the as-at Date, to determine which documents are in the effective-range.
 */
export const joinDoc = (states: IState, index: string, store: string, filter: TWhere = [], date?: number) => {
  return (source: Observable<any>) => defer(() => {
    let parent: any;

    return source.pipe(
      switchMap(data => {
        const filters = decodeFilter(data, cloneObj(filter)); // loop through filters
        parent = data;                                        // stash the original parent data state

        return combineLatest(getStore(states, store, filters, date));
      }),

      map(res => {
        let joins: { [key: string]: any[] } = parent[index] || {};

        res.forEach(table => table
          .forEach((row: any) => {
            const type: string = (getSlice(store) === 'client') ? row[FIELD.store] : row[FIELD.type]; // TODO: dont hardcode 'type'

            joins[type] = joins[type] || [];
            joins[type].push(row);
          })
        )

        Object.keys(joins).map(table => {                     // apply any provided sortBy criteria
          const sortBy = SORTBY[table];
          joins[table] = joins[table].sort(sortKeys(...asArray(sortBy)));
        })

        return { ...parent, ...{ [index]: joins } };
      })
    )
  })
}

/**
 * A helper function to analyze the <value> field of each filter.  
 * If <value> isString and matches {{...}}, it refers to the current <parent> data
 */
const decodeFilter = (parent: any, filter: TWhere) => {
  return asArray(filter).map(cond => {                        // loop through each filter

    cond.value = asArray(cond.value).map(value => {           // loop through filter's <value>

      const isPath = isString(value) && value.substring(0, 2) === '{{';
      let defaultValue: string | undefined;
      let lookup: any;

      if (isPath) {                                           // check if is it a fieldPath reference on the parent
        const child = value.replace('{{', '').replace('}}', '').replace(' ', '');
        const dflt = child.split('.').reverse()[0];           // get the last component of the fieldPath
        const table = (parent['default'][STORE.default] as IDefault[])
          .filter(row => row[FIELD.type] === dflt);           // find the default value for the requested fieldPath

        defaultValue = table.length && table[0][FIELD.key] || undefined;
        lookup = getPath(parent, child);

        if (isArray(lookup))                                  // if fieldPath doesnt exist on <parent>, then fallback to default
          lookup = lookup.map(res => isNull(res) || isUndefined(res) ? defaultValue : res);

      } else
        lookup = value;                                       // a use-able value with no interpolation needed

      return lookup;                                          // rebuild filter's <value>
    });

    if (cond.value.length === 1)
      cond.value = cond.value[0];                             // an array of only one value, return as string

    return cond;                                              // rebuild each filter
  })
}
