import { auth } from 'firebase/app';
import { AuthProvider, AuthCredential } from '@firebase/auth-types';

import { JWT } from '@dbase/auth/auth.interface';
import { IAuthState } from '@dbase/state/auth.define';
import { IObject, isNull } from '@lib/object.library';
import { getStamp } from '@lib/date.library';

export const getAuthProvider = (providerId: string) => {
	let authProvider: AuthProvider;

	switch (providerId) {
		case 'google':
		case 'google.com':
			authProvider = new auth.GoogleAuthProvider();
			break;

		case 'twitter':
		case 'twitter.com':
			authProvider = new auth.TwitterAuthProvider();
			break;

		case 'github':
		case 'github.com':
			authProvider = new auth.GithubAuthProvider();
			break;

		case 'facebook':
		case 'facebook.com':
		default:
			authProvider = new auth.FacebookAuthProvider();
			break;
	}

	return authProvider;
}

export const getAuthCredential = (providerId: string, opts: IObject<any>) => {
	let authCredential: AuthCredential;

	switch (providerId) {
		case 'email':
		default:
			authCredential = auth.GoogleAuthProvider.credential(opts.email, opts.password);
			break;
	}

	return authCredential;
}

export const isActive = (auth: IAuthState) => {
	switch (true) {
		case isNull(auth.userInfo):
		case isNull(auth.userToken):
		case !isNull(auth.userToken) && auth.userToken.claims[JWT.expires] < getStamp():
			return false;													// not authenticated

		default:
			return true;													// authenticated User
	}
}