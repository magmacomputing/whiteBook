import * as firebase from 'firebase/app';
import { BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';

import { AngularFireAuth } from '@angular/fire/auth';
import { State, StateContext, Action, NgxsOnInit, Store } from '@ngxs/store';
import {
	IAuthState, CheckSession, LoginSuccess, LoginFailed, LogoutSuccess, LoginIdentity, Logout, AuthToken,
	LoginEmail, LoginLink, AuthInfo, LoginToken, LoginSetup, LoginCredential, LoginAnon, AuthOther
} from '@dbase/state/auth.action';
import { SLICE, TStateSlice } from '@dbase/state/state.define';

import { SnackService } from '@service/material/snack.service';
import { getAuthProvider, getProviderId } from '@service/auth/auth.library';

import { ROUTE } from '@route/route.define';
import { NavigateService } from '@route/navigate.service';

import { SyncService } from '@dbase/sync/sync.service';
import { COLLECTION, FIELD, STORE } from '@dbase/data/data.define';
import { IRegister } from '@dbase/data/data.schema';
import { addWhere } from '@dbase/fire/fire.library';
import { IQuery } from '@dbase/fire/fire.interface';

import { getLocalStore, delLocalStore, prompt } from '@lib/window.library';
import { getPath } from '@lib/object.library';
import { isNull } from '@lib/type.library';
import { dbg } from '@lib/logger.library';

@State<IAuthState>({
	name: SLICE.auth,
	defaults: {
		user: null,																			// firebase.User object
		token: null,																		// oauth token
		info: null,																			// Provider additionalInfo
		credential: null,																// authenticated user's credential
		current: null,																	// the effective User (used in 'impersonate' mode)
	}
})
export class AuthState implements NgxsOnInit {
	private dbg = dbg(this);
	private user: firebase.User | null = null;
	private _memberSubject = new BehaviorSubject(null as firebase.auth.AdditionalUserInfo | null);

	constructor(private afAuth: AngularFireAuth, private sync: SyncService, private store: Store, private snack: SnackService, private navigate: NavigateService) { this.init(); }

	ngxsOnInit(ctx: StateContext<IAuthState>) { this.init(); }

	private init() {
		this.dbg('init');
		this.afAuth.authState
			.subscribe(user => this.store.dispatch(new CheckSession(user)))
	}

	get memberSubject() {
		return this._memberSubject;
	}

	private async authSuccess(ctx: StateContext<IAuthState>, user: firebase.User | null, credential: firebase.auth.AuthCredential | null) {
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
		const state = ctx.getState();
		this.dbg('%s', user ? `${user.displayName} is logged in` : 'not logged in');

		if (isNull(user) && !isNull(this.user)) {			// TODO: does this affect OAuth logins
			ctx.dispatch(new Logout());									// User logged-out
		}

		if (!isNull(user) && isNull(this.user)) {
			this.user = user;
			ctx.dispatch(new LoginSuccess(user));				// User logged-in
		}
	}

	/**
	 * We allow Users to sign in using multiple authentication providers by linking auth provider credentials to an existing user account.  
	 * Users are identifiable by the same Firebase user ID regardless of the authentication provider they used to sign in.  
	 * For example, a user who signed in with a password can link a Google account and sign in with either method in the future.  
	 * Or, an anonymous user can link a Facebook account and then, later, sign in with Facebook to continue using our App.
	 */
	@Action(LoginCredential)													// attempt to link multiple providers
	async loginCredential(ctx: StateContext<IAuthState>, { link }: LoginCredential) {
		const methods = await this.afAuth.auth.fetchSignInMethodsForEmail(link.email);

		switch (methods[0]) {														// check the first-method
			case firebase.auth.EmailAuthProvider.EMAIL_PASSWORD_SIGN_IN_METHOD:
				let password = prompt('Please enter the password') || '';
				ctx.dispatch(new LoginEmail(link.email, password, 'signIn', link.credential))
				break;

			case firebase.auth.EmailAuthProvider.EMAIL_LINK_SIGN_IN_METHOD:
				ctx.dispatch(new LoginLink(link.emailLink!));
				break;

			default:
				const [type, authProvider] = getAuthProvider(methods[0]);
				switch (type) {
					case 'identity':
					case 'oauth':
						ctx.dispatch(new LoginIdentity(authProvider as firebase.auth.AuthProvider, link.credential));
						break;
				}
		}
	}

	/** Attempt to sign-in a User via authentication by a federated identity provider */
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

	/** Attempt to sign in a User via authentication with a Custom Token */
	@Action(LoginToken)
	async loginToken(ctx: StateContext<IAuthState>, { token, user, prefix }: LoginToken) {
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

	/** Attempt to sign in a User via an emailAddress / Password combination. */
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

	/** Attempt to sign in a User anonymously */
	@Action(LoginAnon)
	LoginAnon(ctx: StateContext<IAuthState>) {
		return this.afAuth.auth.signInAnonymously()
			.catch(error => ctx.dispatch(new LoginFailed(error)));
	}

	/** Attempt to sign in a User via a link sent to their emailAddress */
	@Action(LoginLink)
	async loginLink(ctx: StateContext<IAuthState>, { link, credential }: LoginLink) {
		const localItem = 'emailForSignIn';

		if (this.afAuth.auth.isSignInWithEmailLink(link)) {
			const email = getLocalStore<string>(localItem) ||
				prompt('Please provide your email for confirmation') ||
				'';

			const response = await this.afAuth.auth.signInWithEmailLink(email, link);
			delLocalStore(localItem);

			if (credential)
				this.authSuccess(ctx, response.user, response.credential);
			ctx.dispatch(new LoginSuccess(response.user!));
		}
		else this.snack.error('Not a valid link-address');
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
		const query: IQuery = { where: addWhere(FIELD.uid, user.uid) };

		if (this.afAuth.auth.currentUser) {
			this.sync.on(COLLECTION.attend, query);
			this.sync.on(COLLECTION.member, query)			// wait for /member snap0 
				.then(_ => this._memberSubject.next(ctx.getState().info))
				.then(_ => this.dbg('route: %j', this.navigate.url))
				.then(_ => {
					if (['/', '/login'].includes(this.navigate.url))
						this.navigate.route(ROUTE.attend)
				})
		}
	}

	@Action(AuthInfo)
	async authInfo(ctx: StateContext<IAuthState>, { info }: AuthInfo) {
		ctx.patchState(info);
	}

	@Action(AuthOther)															// mimic another User
	otherMember(ctx: StateContext<IAuthState>, { member }: AuthOther) {
		const state = ctx.getState();

		if (state.current && state.current.uid === member)
			return;																			// nothing to do
		if (state.current && getPath(state.current, 'customClaims.memberName') === member)
			return;																			// nothing to do

		return this.store.selectOnce<TStateSlice<IRegister>>(state => state[SLICE.admin])
			.pipe(
				map(admin => admin[STORE.register]),			// get the Register segment
				map(table => table.find(row => row[FIELD.uid] === member || getPath(row, 'user.customClaims.memberName') === member)),
			)
			.subscribe(reg => ctx.patchState({ current: reg && reg.user }))
			.unsubscribe()
	}

	@Action([LoginSetup, LoginSuccess])							// on each LoginSuccess, fetch latest UserInfo, IdToken
	setUserStateOnSuccess(ctx: StateContext<IAuthState>, { user }: LoginSetup) {
		if (this.afAuth.auth.currentUser) {
			this.afAuth.auth.currentUser.getIdTokenResult()
				.then(token => {
					ctx.patchState({ user, token, current: user });
					if (this.hasRole(token, 'admin'))
						this.sync.on(COLLECTION.admin, undefined,
							[COLLECTION.member, { where: addWhere(FIELD.store, STORE.status) }]);
				})
		}
	}

	private hasRole = (token: firebase.auth.IdTokenResult, role: string) => {
		return getPath<string[]>({ ...token }, 'claims.claims.roles', [])!.includes(role);
	}

	@Action(AuthToken)															// fetch latest IdToken
	setToken(ctx: StateContext<IAuthState>) {
		let token: firebase.auth.IdTokenResult;
		if (this.afAuth.auth.currentUser) {
			this.afAuth.auth.currentUser.getIdTokenResult(true)
				.then(result => token = result)
				.then(_ => ctx.patchState({ token }))
				.then(_ => this.dbg('customClaims: %j', (ctx.getState().token as firebase.auth.IdTokenResult).claims.claims))
				.then(_ => {
					if (this.hasRole(token, 'admin'))
						this.sync.on(COLLECTION.admin, undefined,
							[COLLECTION.member, { where: addWhere(FIELD.store, STORE.status) }]);
					else
						this.sync.off(COLLECTION.admin);
				})
		}
	}

	@Action([LoginFailed, LogoutSuccess])
	notLogin(ctx: StateContext<IAuthState>, { error }: LoginFailed) {
		this.sync.off(COLLECTION.member, true);
		this.sync.off(COLLECTION.attend, true);
		this.sync.off(COLLECTION.admin, true);

		if (error) {
			this.dbg('logout: %j', error);
			this.snack.open(error.message);

			if (error.code === 'auth/account-exists-with-different-credential')
				return ctx.dispatch(new LoginCredential(error));
		}

		ctx.setState({ user: null, token: null, info: null, credential: null, current: null, });
		this.navigate.route(ROUTE.login);
	}
}