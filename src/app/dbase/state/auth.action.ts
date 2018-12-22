import * as firebase from 'firebase/app';

import { ICredential } from '@service/auth/auth.interface';

export interface IAuthState {
	user: firebase.UserInfo | null;
	token: firebase.auth.IdTokenResult | null;
	info: firebase.auth.AdditionalUserInfo | null;       // additionalUserInfo from provider
	credential?: firebase.auth.AuthCredential | null;
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
export class LoginOAuth {
	static type = '[Auth] LoginOAuth';
	constructor(public token: string, public prefix: string, public user: any) { }
}
export class LoginEmail {
	static type = '[Auth] LoginEmail';
	constructor(public email: string, public password: string,
		public method: 'signIn' | 'createUser' = 'signIn',
		public credential?: any) { }
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
export class LoginInfo {
	static type = '[Auth] LoginInfo';
}
export class LoginAdditionalInfo {
	static type = '[Auth] LoginAdditionalInfo';
	constructor(public info: any) { }
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
export class LoginToken {
	static type = '[Auth] LoginToken';
}
export class LoginFailed {
	static type = '[Auth] LoginFailed';
	constructor(public error: any) { }
}