import { auth } from 'firebase/app';
import { AuthProvider, AuthCredential, IdTokenResult } from '@firebase/auth-types';

import { IAuthState } from '@dbase/state/auth.define';
import { TProvider } from '@dbase/data/data.schema';

import { isNull } from '@lib/object.library';

// TODO: derive token requirements from authState.userToken
export const getAuthProvider = (providerId: string, userToken?: IdTokenResult | null): [TProvider, AuthProvider, AuthCredential | undefined] => {
	let authProvider: AuthProvider;
	let authCredential: AuthCredential | undefined = undefined;
	let type: TProvider = 'social';												// default to 'social'

	switch (providerId) {
		case 'email':
			type = 'email'
			authProvider = new auth.EmailAuthProvider();
			// if (userToken)
			// 	authCredential = auth.EmailAuthProvider.credential(userToken.email, userToken.password);
			break;

		case 'google':
		case 'google.com':
			authProvider = new auth.GoogleAuthProvider();
			if (userToken)
				authCredential = auth.GoogleAuthProvider.credential(userToken.token);
			break;

		case 'twitter':
		case 'twitter.com':
			authProvider = new auth.TwitterAuthProvider();
			if (userToken)
				authCredential = auth.TwitterAuthProvider.credential(userToken.token, '')//, userToken.secret);
			break;

		case 'github':
		case 'github.com':
			authProvider = new auth.GithubAuthProvider();
			if (userToken)
				authCredential = auth.GithubAuthProvider.credential(userToken.token);
			break;

		case 'facebook':
		case 'facebook.com':
		default:
			authProvider = new auth.FacebookAuthProvider();
			if (userToken)
				authCredential = auth.FacebookAuthProvider.credential(userToken.token);
			break;
	}

	return [type, authProvider, authCredential];
}

export const isActive = (auth: IAuthState) => {
	switch (true) {
		case isNull(auth.userInfo):
		case isNull(auth.userToken):
			// case !isNull(auth.userToken) && auth.userToken.claims[JWT.expires] < getStamp():
			return false;													// not authenticated

		default:
			return true;													// Auth State still valid
	}
}