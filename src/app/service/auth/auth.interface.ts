import * as firebase from 'firebase/app';

import { ICustomClaims } from '@dbase/data/data.schema';

export type TParams = firebase.auth.GoogleAuthProvider | firebase.auth.FacebookAuthProvider | firebase.auth.TwitterAuthProvider | firebase.auth.GithubAuthProvider | firebase.auth.OAuthProvider;
export type TScopes = firebase.auth.GoogleAuthProvider | firebase.auth.FacebookAuthProvider | firebase.auth.GithubAuthProvider | firebase.auth.OAuthProvider;

export interface ICredential {
	code: string;
	message: string;
	email: string;
	providerId: string;
	signInMethod: string;
	credential: firebase.auth.AuthCredential;
	oauthAccessToken?: string;
	emailLink?: string;
}

export interface IUserInfo {			// borrowed from firebase-admin/auth
	uid: string;
	displayName: string;
	email: string;
	phoneNumber: string;
	photoURL: string;
	providerId: string;
}

export interface IFireClaims {
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
export interface IJwtClaims {			// industry-standard json-web-token format
	exp: number;						// expiration time
	iss: string;						// issuer
	iat?: number;						// issued time
	nbf?: number;						// not before
	aud?: string;						// audience
	sub?: string;						// subject
}
export type TTokenClaims = IFireClaims & ICustomClaims & IJwtClaims;
export enum JWT {
	expires = 'exp',
	not_before = 'nbf',
	issuer = 'iss',
	audience = 'aud',
	subject = 'sub',
}

export enum ROLES {
	member = 'member',
	admin = 'admin',
	guest = 'guest',
}