import { CustomClaims } from '@dbase/data/data.schema';

export type TParams = firebase.auth.GoogleAuthProvider | firebase.auth.FacebookAuthProvider | firebase.auth.TwitterAuthProvider | firebase.auth.GithubAuthProvider | firebase.auth.OAuthProvider;
export type TScopes = firebase.auth.GoogleAuthProvider | firebase.auth.FacebookAuthProvider | firebase.auth.GithubAuthProvider | firebase.auth.OAuthProvider;

export interface Credential {
	code: string;
	message: string;
	email: string;
	providerId: string;
	signInMethod: string;
	credential: firebase.auth.AuthCredential;
	oauthAccessToken?: string;
	emailLink?: string;
}

export interface UserInfo {			// borrowed from firebase-admin/auth
	uid: string;
	displayName: string;
	email: string;
	phoneNumber: string;
	photoURL: string;
	providerId: string;
}

export interface FireClaims {
	user_id: string;
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
export interface JwtClaims {			// industry-standard json-web-token format
	exp: number;						// expiration time
	iss: string;						// issuer
	iat?: number;						// issued time
	nbf?: number;						// not before
	aud?: string;						// audience
	sub?: string;						// subject
}
export type TTokenClaims = FireClaims & CustomClaims & JwtClaims;
export enum JWT {
	expires = 'exp',
	not_before = 'nbf',
	issuer = 'iss',
	audience = 'aud',
	subject = 'sub',
}
