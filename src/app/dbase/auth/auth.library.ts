import { auth } from 'firebase/app';
import { AuthProvider, AuthCredential } from '@firebase/auth-types';

import { IAuthState } from '@dbase/state/auth.define';
import { TProvider } from '@dbase/data/data.schema';

import { IObject, isNull } from '@lib/object.library';

export const getAuthProvider = (providerId: string, token?: any): [TProvider, AuthProvider, AuthCredential | undefined] => {
	let authProvider: AuthProvider;
	let authCredential: AuthCredential | undefined = undefined;
	let type: TProvider = 'social';

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
				authCredential = auth.GoogleAuthProvider.credential(token.idToken, token.accessToken);
			break;

		case 'twitter':
		case 'twitter.com':
			authProvider = new auth.TwitterAuthProvider();
			if (token)
				authCredential = auth.TwitterAuthProvider.credential(token.token, token.secret);
			break;

		case 'github':
		case 'github.com':
			authProvider = new auth.GithubAuthProvider();
			if (token)
				authCredential = auth.GithubAuthProvider.credential(token);
			break;

		case 'facebook':
		case 'facebook.com':
		default:
			authProvider = new auth.FacebookAuthProvider();
			if (token)
				authCredential = auth.FacebookAuthProvider.credential(token);
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