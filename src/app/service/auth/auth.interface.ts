import type firebase from 'firebase/app';

export type TParams = firebase.auth.GoogleAuthProvider | firebase.auth.FacebookAuthProvider | firebase.auth.TwitterAuthProvider | firebase.auth.GithubAuthProvider | firebase.auth.OAuthProvider;
export type TScopes = firebase.auth.GoogleAuthProvider | firebase.auth.FacebookAuthProvider | firebase.auth.GithubAuthProvider | firebase.auth.OAuthProvider;

export interface LoginCredential {
	code: string;
	message: string;
	email: string;
	providerId: string;
	signInMethod: string;
	credential: firebase.auth.AuthCredential;
	oauthAccessToken?: string;
	emailLink?: string;
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
