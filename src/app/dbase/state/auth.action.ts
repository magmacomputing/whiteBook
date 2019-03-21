import * as firebase from 'firebase/app';

import { ICredential } from '@service/auth/auth.interface';
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
	static type = '[Auth] CheckSession';
	constructor(public user: firebase.User | null) { }
}
export class LoginCredential {
	static type = '[Auth] LoginCredential';
	constructor(public link: ICredential) { }
}
export class LoginIdentity {
	static type = '[Auth] LoginIdentity';
	constructor(public authProvider: firebase.auth.AuthProvider, public credential?: any) { }
}
export class LoginToken {
	static type = '[Auth] LoginToken';
	constructor(public token: string, public prefix: string, public user: any) { }
}
export class LoginOIDC {
	static type = '[Auth] LoginOIDC';
	constructor(public token: string, public prefix: string, public user: any) { }
}
export class LoginEmail {
	static type = '[Auth] LoginEmail';
	constructor(public email: string, public password: string,
		public method: 'signIn' | 'createUser' = 'signIn',
		public credential?: any) { }
}
export class LoginAnon {
	static type = '[Auth] LoginAnon';
}
export class LoginLink {
	static type = '[Auth] LoginLink';
	constructor(public link: string, public credential?: any) { }
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
	constructor(public user: firebase.User) { }
}
export class LoginSetup {
	static type = '[Auth] LoginSetup';
	constructor(public user: firebase.User) { }
}

export class MemberInfo {												// signal MemberService to check for ProviderInfo changes
	static type = '[Auth] MemberInfo';
}
export class AuthInfo {													// fetch AdditionalUserInfo into auth state
	static type = '[Auth] AuthInfo';
	constructor(public info: any) { }
}
export class AuthToken {
	static type = '[Auth] AuthToken';
}
export class AuthOther {												// Event to request impersonate another Member
	static type = '[Auth] AuthOther';
	constructor(public member: string) { }				// 'member' can be a <uid> or a <memberName>
}
export class LoginFailed {
	static type = '[Auth] LoginFailed';
	constructor(public error: any) { }
}