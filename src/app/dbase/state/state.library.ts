import { AngularFirestore } from 'angularfire2/firestore';
import { Observable, defer } from 'rxjs';

import { TTokenClaims, IFireClaims } from '@dbase/auth/auth.interface';
import { IProfilePlan, IProfileInfo, IDefault, IPlan, IPrice, IAccount } from '@dbase/data/data.schema';

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

export const joinDoc = (afs: AngularFirestore, paths: { [key: string]: string }) => {
  return (source: Observable<any>) => defer(() => {
    let parent;
    const keys = Object.keys(paths);

    return source.pipe
  })
}