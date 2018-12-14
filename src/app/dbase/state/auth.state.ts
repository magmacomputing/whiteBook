import { IdTokenResult, AuthProvider, AuthCredential } from '@firebase/auth-types';
import { AngularFireAuth } from '@angular/fire/auth';

import { State, StateContext, Action, NgxsOnInit } from '@ngxs/store';
import {
	IAuthState, CheckSession, LoginSuccess, LoginFailed, LogoutSuccess, LoginIdentity, Logout, LoginToken,
	LoginEmail, LoginLink, LoginInfo, LoginOAuth, LoginSetup, LoginAdditionalInfo
} from '@dbase/state/auth.action';
import { SLICE } from '@dbase/state/state.define';

import { SnackService } from '@service/snack/snack.service';
import { getAuthProvider, getProviderId } from '@service/auth/auth.library';

import { ROUTE } from '@route/route.define';
import { NavigateService } from '@route/navigate.service';

import { SyncService } from '@dbase/sync/sync.service';
import { COLLECTION, FIELD } from '@dbase/data/data.define';
import { IQuery } from '@dbase/fire/fire.interface';

import { isNull } from '@lib/type.library';
import { dbg } from '@lib/logger.library';

@State<IAuthState>({
	name: SLICE.auth,
	defaults: {
		user: null,
		token: null,
		info: null,
		credential: null,
	}
})
export class AuthState implements NgxsOnInit {
	private dbg = dbg(this);
	private user: firebase.User | null = null;

	constructor(private afAuth: AngularFireAuth, private sync: SyncService, private snack: SnackService, private navigate: NavigateService) { }

	ngxsOnInit(ctx: StateContext<IAuthState>) {
		this.dbg('init');
		this.afAuth.authState
			.subscribe(user => ctx.dispatch(new CheckSession(user)))
	}

	private async authSuccess(ctx: StateContext<IAuthState>, user: firebase.User | null, credential: AuthCredential) {
		if (user) {
			if (credential) {														// have we been redirected here, via credential?
				const response = await user.linkAndRetrieveDataWithCredential(credential);
				ctx.patchState({ info: response.additionalUserInfo });
			}
		}
		else ctx.dispatch(new LoginFailed(new Error('No User information available')))
	}

	/** Commands */
	@Action(CheckSession)														// check Authentication status
	checkSession(ctx: StateContext<IAuthState>, { user }: CheckSession) {
		this.dbg('%s', user ? `${user.displayName} is logged in` : 'not logged in');

		if (isNull(user) && !isNull(this.user)) {
			ctx.dispatch(new Logout());									// User has logged-out remotely
		}

		if (!isNull(user) && isNull(this.user)) {
			this.user = user;
			ctx.dispatch(new LoginSuccess(user));				// User logged-in
		}
	}

	@Action(LoginLink)														// attempt to link multiple providers
	async loginLink(ctx: StateContext<IAuthState>, { link }: LoginLink) {
		const methods = await this.afAuth.auth.fetchSignInMethodsForEmail(link.email);
		this.dbg('methods: %j', methods);

		if (methods[0] === 'password') {
			let password = window.prompt('Please enter the password') || '';
			ctx.dispatch(new LoginEmail(link.email, password, 'signIn', link.credential))
		} else {
			const [type, authProvider] = getAuthProvider(methods[0]);
			switch (type) {
				case 'identity':
					ctx.dispatch(new LoginIdentity(authProvider as AuthProvider, link.credential));
					break;
			}
		}
	}

	@Action(LoginIdentity)														// process signInWithPopup()
	async loginIdentity(ctx: StateContext<IAuthState>, { authProvider, credential }: LoginIdentity) {
		try {
			const response = await this.afAuth.auth.signInWithPopup(authProvider);

			if (!credential)
				ctx.patchState({ info: response.additionalUserInfo, credential: response.credential });
			this.authSuccess(ctx, response.user, credential);

		} catch (error) {
			ctx.dispatch(new LoginFailed(error));
		}
	}

	@Action(LoginOAuth)
	async loginToken(ctx: StateContext<IAuthState>, { token, user, prefix }: LoginOAuth) {
		const additionalUserInfo: firebase.auth.AdditionalUserInfo = {
			isNewUser: false,
			providerId: getProviderId(prefix),
			profile: user,
		}
		ctx.patchState({ info: additionalUserInfo });

		this.afAuth.auth.signInWithCustomToken(token)
			.then(response => ctx.dispatch(new LoginSetup(response.user!)))
			.catch(error => this.dbg('failed: %j', error.toString()));
	}

	@Action(LoginEmail)															// process signInWithEmailAndPassword
	loginEmail(ctx: StateContext<IAuthState>, { email, password, method, credential }: LoginEmail) {
		type TEmailMethod = 'signInWithEmailAndPassword' | 'createUserWithEmailAndPassword';
		const thisMethod = `${method}WithEmailAndPassword` as TEmailMethod;
		this.dbg('loginEmail: %s', method);

		try {
			return this.afAuth.auth[thisMethod](email, password)
				.then(response => this.authSuccess(ctx, response.user, credential))
				.catch(async error => {
					switch (error.code) {
						case 'auth/user-not-found':				// need to 'create' first
							return ctx.dispatch(new LoginEmail(email, password, 'createUser'));

						default:
							return ctx.dispatch(new LoginFailed(error));
					}
				})
		} catch (error) {
			return ctx.dispatch(new LoginFailed(error));
		}
	}

	@Action(Logout)																	// process signOut()
	async logout(ctx: StateContext<IAuthState>) {
		this.user = null;
		await this.afAuth.auth.signOut();

		ctx.dispatch(new LogoutSuccess());
		return;
	}

	/** Events */
	@Action(LoginSuccess)														// on each LoginSuccess, fetch /member collection
	onMember(ctx: StateContext<IAuthState>, { user }: LoginSuccess) {
		const query: IQuery = { where: { fieldPath: FIELD.uid, value: user.uid } };

		if (this.afAuth.auth.currentUser) {
			this.sync.on(COLLECTION.attend, SLICE.attend, query);
			this.sync.on(COLLECTION.member, SLICE.member, query)	// wait for /member snap0 
				.then(_ => ctx.dispatch(new LoginInfo()))						// check for AdditionalUserInfo
				.then(_ => this.navigate.route(ROUTE.attend))
		}
	}

	@Action(LoginAdditionalInfo)
	async additionalInfo(ctx: StateContext<IAuthState>, { info }: LoginAdditionalInfo) {
		ctx.patchState(info);
	}

	@Action([LoginSetup, LoginSuccess])							// on each LoginSuccess, fetch latest UserInfo, IdToken
	setUserStateOnSuccess(ctx: StateContext<IAuthState>, { user }: LoginSetup) {
		if (this.afAuth.auth.currentUser) {
			this.afAuth.auth.currentUser.getIdTokenResult()
				.then(token => ctx.patchState({ user, token }))
		}
	}

	@Action(LoginToken)															// fetch latest IdToken
	setToken(ctx: StateContext<IAuthState>) {
		if (this.afAuth.auth.currentUser) {
			this.afAuth.auth.currentUser.getIdTokenResult(true)
				.then(token => ctx.patchState({ token }))
				.then(_ => this.dbg('customClaims: %j', (ctx.getState().token as IdTokenResult).claims.claims))
		}
	}

	@Action([LoginFailed, LogoutSuccess])
	notLogin(ctx: StateContext<IAuthState>, { error }: LoginFailed) {
		this.sync.off(COLLECTION.member, true);
		this.sync.off(COLLECTION.attend, true);

		if (error) {
			this.dbg('logout: %j', error);
			this.snack.open(error.message);

			if (error.code === 'auth/account-exists-with-different-credential')
				return ctx.dispatch(new LoginLink(error));
		}

		ctx.setState({ user: null, token: null, info: null, credential: null });
		this.navigate.route(ROUTE.login);
	}
}