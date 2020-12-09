import type firebase from 'firebase/app';

import { LoginCredential } from '@service/auth/auth.interface';

import { auth } from '@dbase/data.define';
import type { Register } from '@dbase/data.schema';

export interface AuthSlice {
	user: firebase.UserInfo | null;
	token: firebase.auth.IdTokenResult | null;
	info: firebase.auth.AdditionalUserInfo | null;				// additionalUserInfo from provider
	credential: firebase.auth.AuthCredential | null;
	current: Register["user"] | null;																// effective UserId
}

// Actions
export namespace LoginAction {
	export class Check {
		static readonly type = '[Auth] CheckSession';
		constructor(public user: firebase.User | null) { }
	}
	export class Credential {
		static readonly type = '[Auth] LoginCredential';
		constructor(public link: LoginCredential) { }
	}
	export class Identity {
		static readonly type = '[Auth] LoginIdentity';
		constructor(public authProvider: firebase.auth.AuthProvider, public credential?: any) { }
	}
	export class Token {
		static readonly type = '[Auth] LoginToken';
		constructor(public token: string, public prefix: auth.PROVIDER, public user: any) { }
	}
	export class OIDC {
		static readonly type = '[Auth] LoginOIDC';
		constructor(public token: string, public prefix: auth.PROVIDER, public user: any) { }
	}
	export class Email {
		static readonly type = '[Auth] LoginEmail';
		constructor(public email: string, public password: string,
			public method: 'signIn' | 'createUser' = 'signIn',
			public credential?: any) { }
	}
	export class Anon {
		static readonly type = '[Auth] LoginAnon';
	}
	export class Link {
		static readonly type = '[Auth] LoginLink';
		constructor(public link: string, public credential?: any) { }
	}
	export class Out {
		static readonly type = '[Auth] Logout';
	}
	export class Off {
		static readonly type = '[Auth] LogoutSuccess';
	}
	export class Other {														// Event to request impersonate another Member
		static readonly type = '[Auth] AuthOther';
		constructor(public alias?: string) { }				// 'alias' of Member UID
	}
}
// Events
export namespace LoginEvent {
	export class Redirect {
		static readonly type = '[Auth] LoginRedirect';
	}
	export class Success {
		static readonly type = '[Auth] LoginSuccess';
		constructor(public user: firebase.User) { }
	}
	export class Setup {
		static readonly type = '[Auth] LoginSetup';
		constructor(public user: firebase.User) { }
	}
	export class Info {															// fetch AdditionalUserInfo into auth state
		static readonly type = '[Auth] AuthInfo';
		constructor(public info: any) { }
	}
	export class Token {
		static readonly type = '[Auth] AuthToken';
	}
	export class Failed {
		static readonly type = '[Auth] LoginFailed';
		constructor(public error: any) { }
	}
}
