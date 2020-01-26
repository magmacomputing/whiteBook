import * as firebase from 'firebase/app';

import { ICredential } from '@service/auth/auth.interface';
import { Auth } from '@dbase/data/data.define';
import { TUser } from '@dbase/data/data.schema';

export interface IAuthState {
	user: firebase.UserInfo | null;
	token: firebase.auth.IdTokenResult | null;
	info: firebase.auth.AdditionalUserInfo | null;				// additionalUserInfo from provider
	credential: firebase.auth.AuthCredential | null;
	current: TUser | null;																// effective UserId
}

// Actions
export class CheckSession {
	static readonly type = '[Auth] CheckSession';
	constructor(public user: firebase.User | null) { }
}
export class LoginCredential {
	static readonly type = '[Auth] LoginCredential';
	constructor(public link: ICredential) { }
}
export class LoginIdentity {
	static readonly type = '[Auth] LoginIdentity';
	constructor(public authProvider: firebase.auth.AuthProvider, public credential?: any) { }
}
export class LoginToken {
	static readonly type = '[Auth] LoginToken';
	constructor(public token: string, public prefix: Auth.PROVIDER, public user: any) { }
}
export class LoginOIDC {
	static readonly type = '[Auth] LoginOIDC';
	constructor(public token: string, public prefix: Auth.PROVIDER, public user: any) { }
}
export class LoginEmail {
	static readonly type = '[Auth] LoginEmail';
	constructor(public email: string, public password: string,
		public method: 'signIn' | 'createUser' = 'signIn',
		public credential?: any) { }
}
export class LoginAnon {
	static readonly type = '[Auth] LoginAnon';
}
export class LoginLink {
	static readonly type = '[Auth] LoginLink';
	constructor(public link: string, public credential?: any) { }
}
export class Logout {
	static readonly type = '[Auth] Logout';
}
export class LogoutSuccess {
	static readonly type = '[Auth] LogoutSuccess';
}

// Events
export class LoginRedirect {
	static readonly type = '[Auth] LoginRedirect';
}
export class LoginSuccess {
	static readonly type = '[Auth] LoginSuccess';
	constructor(public user: firebase.User) { }
}
export class LoginSetup {
	static readonly type = '[Auth] LoginSetup';
	constructor(public user: firebase.User) { }
}
export class AuthInfo {													// fetch AdditionalUserInfo into auth state
	static readonly type = '[Auth] AuthInfo';
	constructor(public info: any) { }
}
export class AuthToken {
	static readonly type = '[Auth] AuthToken';
}
export class AuthOther {												// Event to request impersonate another Member
	static readonly type = '[Auth] AuthOther';
	constructor(public alias?: string) { }				// 'alias' of Member UID
}
export class LoginFailed {
	static readonly type = '[Auth] LoginFailed';
	constructor(public error: any) { }
}