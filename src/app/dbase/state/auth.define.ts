import { User, UserInfo, AuthProvider, IdTokenResult } from '@firebase/auth-types';
import { IProvider } from '@dbase/data/data.interface';

export interface IAuthState {
  userInfo: UserInfo | null;
  userToken: IdTokenResult | null;
}

// Actions
export class CheckSession {
  static type = '[Auth] CheckSession';
}
export class LoginSocial {
  static type = '[Auth] LoginSocial';
  constructor(public authProvider: AuthProvider) { }
}
export class LoginEmail {
  static type = '[Auth] LoginEmail';
  constructor(public email: string, public password: string, public method?: 'login' | 'create') { }
}
export class Logout {
  static type = '[Auth] Logout';
}
export class LogoutSuccess {
  static type = '[Auth] LogoutSuccess';
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
  constructor(public error: any, public method?: string, public data?: any) { }
}