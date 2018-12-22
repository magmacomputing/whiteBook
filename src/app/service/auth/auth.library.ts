import * as firebase from 'firebase/app';

import { IUserState } from '@dbase/state/state.define';
import { TProvider } from '@dbase/data/data.schema';

import { isNull } from '@lib/type.library';

interface IEmailToken {
	email: string;
	password: string;
}
export const getAuthProvider = (providerId: string,
	token?: (firebase.auth.IdTokenResult & IEmailToken) | null): [TProvider | undefined, firebase.auth.AuthProvider | undefined, firebase.auth.AuthCredential | undefined] => {
	let authProvider: firebase.auth.AuthProvider | undefined;
	let authCredential: firebase.auth.AuthCredential | undefined;
	let type: TProvider | undefined = 'identity';												// default to 'identity'

	switch (providerId) {
		case 'email':
			type = 'email'
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

		default:
			type = undefined;
			break;
	}

	return [type, authProvider, authCredential];
}

export const getProviderId = (prefix: string) => {
	switch (prefix) {
		case 'li':
			return 'linkedin.com';

		default:
			return 'unknown';
	}
}

export const isActive = (state: IUserState) => {
	switch (true) {
		case isNull(state.auth.user):
		case isNull(state.auth.token):
			return false;													// not authenticated

		default:
			return true;													// Auth State still valid
	}
}