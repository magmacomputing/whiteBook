import firebase from 'firebase/app';

import { UserState } from '@dbase/state/state.define';
import { Auth } from '@dbase/data/data.define';

import { isNull } from '@library/type.library';

interface EmailToken {
	email: string;
	password: string;
}
export const getAuthProvider = (providerId: string,
	token?: (firebase.auth.IdTokenResult & EmailToken) | null): [Auth.METHOD | undefined, firebase.auth.AuthProvider | undefined, firebase.auth.AuthCredential | undefined] => {
	let authProvider: firebase.auth.AuthProvider | undefined;
	let authCredential: firebase.auth.AuthCredential | undefined;
	let method: Auth.METHOD | undefined = Auth.METHOD.identity;									// default to 'identity' 

	switch (providerId) {
		case Auth.METHOD.email:
			method = Auth.METHOD.email
			authProvider = new firebase.auth.EmailAuthProvider();
			if (token)
				authCredential = firebase.auth.EmailAuthProvider.credential(token.email, token.password);
			break;

		case 'google':
		case 'google.com':
			authProvider = new firebase.auth.GoogleAuthProvider();
			if (token)
				authCredential = firebase.auth.GoogleAuthProvider.credential(token.token);
			break;

		case 'twitter':
		case 'twitter.com':
			authProvider = new firebase.auth.TwitterAuthProvider();
			if (token)
				authCredential = firebase.auth.TwitterAuthProvider.credential(token.token, '');
			break;

		case 'github':
		case 'github.com':
			authProvider = new firebase.auth.GithubAuthProvider();
			if (token)
				authCredential = firebase.auth.GithubAuthProvider.credential(token.token);
			break;

		case 'facebook':
		case 'facebook.com':
			authProvider = new firebase.auth.FacebookAuthProvider();
			if (token)
				authCredential = firebase.auth.FacebookAuthProvider.credential(token.token);
			break;

		// case 'linkedin':
		// case 'linkedin.com':
		// 	authProvider = new auth.OAuthProvider('oidc.' + providerId);
		// if (token)
		// authCredential = authProvider.credential(token, null);
		// 	break;

		default:
			method = undefined;
			break;
	}

	return [method, authProvider, authCredential];
}

export const getProviderId = (prefix: Auth.PROVIDER) => {
	switch (prefix) {
		case Auth.PROVIDER.fb:
			return 'facebook.com';

		case Auth.PROVIDER.go:
			return 'google.com';

		case Auth.PROVIDER.tw:
			return 'twitter.com';

		case Auth.PROVIDER.gh:
			return 'github.com';

		case Auth.PROVIDER.li:
			return 'linkedin.com';

		case Auth.PROVIDER.as:											// Google Apps Sheet
			return 'docs.google.com';

		default:
			return 'unknown';
	}
}

export const isActive = (state: UserState) => {
	switch (true) {
		case isNull(state.auth.user):
		case isNull(state.auth.token):
			return false;													// not authenticated

		default:
			return true;													// Auth State still valid
	}
}