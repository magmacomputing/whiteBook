import { auth } from 'firebase/app';

import { UserState } from '@dbase/state/state.define';
import { Auth } from '@dbase/data/data.define';

import { isNull } from '@library/type.library';

interface EmailToken {
	email: string;
	password: string;
}
export const getAuthProvider = (providerId: string,
	token?: (auth.IdTokenResult & EmailToken) | null): [Auth.METHOD | undefined, auth.AuthProvider | undefined, auth.AuthCredential | undefined] => {
	let authProvider: auth.AuthProvider | undefined;
	let authCredential: auth.AuthCredential | undefined;
	let method: Auth.METHOD | undefined = Auth.METHOD.identity;									// default to 'identity' 

	switch (providerId) {
		case Auth.METHOD.email:
			method = Auth.METHOD.email
			authProvider = new auth.EmailAuthProvider();
			// authProvider = new auth.EmailAuthProvider();
			if (token)
				authCredential = auth.EmailAuthProvider.credential(token.email, token.password);
			break;

		case 'google':
		case 'google.com':
			authProvider = new auth.GoogleAuthProvider();
			if (token)
				authCredential = auth.GoogleAuthProvider.credential(token.token);
			break;

		case 'twitter':
		case 'twitter.com':
			authProvider = new auth.TwitterAuthProvider();
			if (token)
				authCredential = auth.TwitterAuthProvider.credential(token.token, '');
			break;

		case 'github':
		case 'github.com':
			authProvider = new auth.GithubAuthProvider();
			if (token)
				authCredential = auth.GithubAuthProvider.credential(token.token);
			break;

		case 'facebook':
		case 'facebook.com':
			authProvider = new auth.FacebookAuthProvider();
			if (token)
				authCredential = auth.FacebookAuthProvider.credential(token.token);
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