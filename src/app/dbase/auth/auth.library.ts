import { auth } from 'firebase/app';
import { AuthProvider, AuthCredential, IdTokenResult } from '@firebase/auth-types';

import { IAuthState } from '@dbase/state/auth.define';
import { TProvider } from '@dbase/data/data.schema';

import { isNull } from '@lib/type.library';

// TODO: derive token requirements from authState.token
interface IEmailToken {
	email: string;
	password: string;
}
export const getAuthProvider = (providerId: string, token?: (IdTokenResult & IEmailToken) | null): [TProvider | undefined, AuthProvider | undefined, AuthCredential | undefined] => {
	let authProvider: AuthProvider | undefined;
	let authCredential: AuthCredential | undefined;
	let type: TProvider | undefined = 'identity';												// default to 'identity'

	switch (providerId) {
		case 'email':
			type = 'email'
			authProvider = new auth.EmailAuthProvider();
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
				authCredential = auth.TwitterAuthProvider.credential(token.token, '')//, token.secret);
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

export const isActive = (auth: IAuthState) => {
	switch (true) {
		case isNull(auth.user):
		case isNull(auth.token):
			return false;													// not authenticated

		default:
			return true;													// Auth State still valid
	}
}