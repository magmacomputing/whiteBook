import { User, UserInfo, AuthProvider, IdTokenResult, AdditionalUserInfo, AuthCredential } from '@firebase/auth-types';
import { ILink } from '@dbase/auth/auth.interface';

export interface IAuthState {
  userInfo: UserInfo | null;
  userToken: IdTokenResult | null;
  userProfile: AdditionalUserInfo | null | undefined; // additionalUserInfo
  userCredential: AuthCredential | null;
}

// Actions
export class CheckSession {
  static type = '[Auth] CheckSession';
}
export class LoginLink {
  static type = '[Auth] LoginLink';
  constructor(public link: ILink) { }
}
export class LoginSocial {
  static type = '[Auth] LoginSocial';
  constructor(public authProvider: AuthProvider, public credential?: any) { }
}
export class LoginEmail {
  static type = '[Auth] LoginEmail';
  constructor(public email: string, public password: string,
    public method: 'signIn' | 'createUser' = 'signIn',
    public credential?: any) { }
}
export class Logout {
  static type = '[Auth] Logout';
}
export class LogoutSuccess {
  static type = '[Auth] LogoutSuccess';
}
export class AuthProfile {
  static type = '[Auth] AuthProfile';
}

// Events
export class LoginRedirect {
  static type = '[Auth] LoginRedirect';
}
export class LoginSuccess {
  static type = '[Auth] LoginSuccess';
  constructor(public user: User) { }
}
export class LoginToken {
  static type = '[Auth] LoginToken';
}
export class LoginFailed {
  static type = '[Auth] LoginFailed';
  constructor(public error: any) { }
}