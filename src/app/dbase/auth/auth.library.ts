import { auth } from 'firebase/app';
import { AuthProvider, } from '@firebase/auth-types';

export const getAuthProvider = (providerId: string) => {
	let authProvider: AuthProvider;
	// if (!firebase.auth)             // is the 'auth' namespace present
	// 	throw new Error('Firebase Authentication not initialized');

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