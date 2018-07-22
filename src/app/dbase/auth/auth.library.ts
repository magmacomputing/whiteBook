import { auth } from 'firebase/app';
import { AuthProvider, AuthCredential } from '@firebase/auth-types';

import { JWT } from '@dbase/auth/auth.interface';
import { IAuthState } from '@dbase/state/auth.define';
import { TProvider } from '@dbase/data/data.interface';
import { IObject, isNull } from '@lib/object.library';
import { getStamp } from '@lib/date.library';

export const getAuthProvider = (providerId: string): [AuthProvider, TProvider] => {
	let authProvider: AuthProvider;
	let type: TProvider;

	switch (providerId) {
		case 'google':
		case 'google.com':
			authProvider = new auth.GoogleAuthProvider();
			type = 'social';
			break;

		case 'twitter':
		case 'twitter.com':
			authProvider = new auth.TwitterAuthProvider();
			type = 'social';
			break;

		case 'github':
		case 'github.com':
			authProvider = new auth.GithubAuthProvider();
			type = 'social';
			break;

		case 'facebook':
		case 'facebook.com':
		default:
			authProvider = new auth.FacebookAuthProvider();
			type = 'social';
			break;
	}

	return [authProvider, type];
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