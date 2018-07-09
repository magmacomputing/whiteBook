import { auth } from 'firebase/app';
import { AuthProvider, AuthCredential } from '@firebase/auth-types';
import { IObject } from '@lib/object.library';

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