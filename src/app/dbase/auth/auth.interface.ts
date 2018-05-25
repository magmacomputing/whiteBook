import { AuthCredential, GoogleAuthProvider, FacebookAuthProvider, TwitterAuthProvider, GithubAuthProvider } from '@firebase/auth-types';

export type TParams = GoogleAuthProvider | FacebookAuthProvider | TwitterAuthProvider | GithubAuthProvider;
export type TScopes = GoogleAuthProvider | FacebookAuthProvider | GithubAuthProvider;

export interface ILink {
	code: string;
	message: string;
	email: string;
	providerId: string;
	signInMethod: string;
	credential: AuthCredential;
	oauthAccessToken?: string;
}

export interface IUserInfo {					// borrowed from firebase-admin/auth
	uid: string;
	displayName: string;
	email: string;
	phoneNumber: string;
	photoURL: string;
	providerId: string;
}

export interface ICustomClaims {	// a special sub-set of fields from the User Token
	memberName?: string;
	memberUid?: string;
	roles?: string[];
}
export interface IFireClaims {
	user_id: string;
	sub: string;
	name: string;
	picture: string;
	email: string;
	email_verified: boolean;
	firebase: {
		identities: {
			[provider: string]: string[];
		},
		sign_in_provider: string;
	}
	auth_time: number;
}
export interface IJwtClaims {		// industry-standard json-web-token format
	iss: string;						// issuer
	iat?: number;						// issued time
	exp: number;						// expiration time
	nbf?: number;						// not before
	aud?: string;						// audience
	sub?: string;						// subject
}
export type TTokenClaims = IFireClaims & ICustomClaims & IJwtClaims;
export const enum JWT {
	expires = 'exp',
	not_before = 'nbf',
	issuer = 'iss',
	audience = 'aud',
	subject = 'sub',
}

export const enum ROLES {
	member = 'member',
	admin = 'admin',
}