import { AngularFirestore } from 'angularfire2/firestore';
import { Observable, defer, combineLatest } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';

import { IStoreState } from '@dbase/state/store.define';
import { TWhere } from '@dbase/fire/fire.interface';
import { TTokenClaims, IFireClaims } from '@dbase/auth/auth.interface';
import { IProfilePlan, IProfileInfo, IDefault, IPlan, IPrice, IAccount } from '@dbase/data/data.schema';

import { asAt } from '@dbase/app/app.library';

interface IUserProfile {
  uid: string;
  providerId: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

export interface IUserState {
  auth: {
    user: IUserProfile;                 // Firebase User Account
    claims: TTokenClaims;               // authenticated customClaims
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

/** Join a Parent document to other documents referenced a supplied string of key fields */
export const joinDoc = <T>(slice: Observable<IStoreState<T>>, store: string, paths: { [key: string]: string }, filter: TWhere = [], date?: number) => {
  return (source: Observable<any>) => defer(() => {
    let parent: any;
    const keys = Object.keys(paths);

    return source.pipe(
      switchMap(data => {
        parent = data;

        const docs$ = keys.map(key => getStore(slice, store, filter, date))

        return combineLatest(docs$);
      }),
      map(arr => {
        const joins = keys.reduce((acc, cur, idx) => {
          return { ...acc, [cur]: arr[idx] };
        }, {});

        return { ...parent, ...joins };
      })
    )
  })
}