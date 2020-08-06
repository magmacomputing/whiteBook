import { Injectable } from '@angular/core';
import { auth } from 'firebase/app';
import { AngularFireAuth } from '@angular/fire/auth';

import { State, StateContext, Action, Store } from '@ngxs/store';
import { BehaviorSubject } from 'rxjs';
import { map, take } from 'rxjs/operators';

import { IAuthState, Login, Event } from '@dbase/state/auth.action';
import { TStateSlice, SLICE } from '@dbase/state/state.define';

import { SnackService } from '@service/material/snack.service';
import { getAuthProvider, getProviderId } from '@service/auth/auth.library';

import { ROUTE } from '@route/router/route.define';
import { NavigateService } from '@route/router/navigate.service';

import { SyncService } from '@dbase/sync/sync.service';
import { COLLECTION, FIELD, STORE, Auth } from '@dbase/data/data.define';
import { IRegister } from '@dbase/data/data.schema';
import { addWhere } from '@dbase/fire/fire.library';
import { IQuery } from '@dbase/fire/fire.interface';

import { getLocalStore, delLocalStore, prompt } from '@library/browser.library';
import { getPath, cloneObj } from '@library/object.library';
import { isNull, isArray } from '@library/type.library';
import { dbg } from '@library/logger.library';

@Injectable()
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
export class AuthState {
	private dbg = dbg(this);
	private user: firebase.User | null = null;
	private _memberSubject = new BehaviorSubject(null as firebase.auth.AdditionalUserInfo | null);

	constructor(private afAuth: AngularFireAuth, private sync: SyncService, private store: Store, private snack: SnackService, private navigate: NavigateService) { this.init(); }

	private init() {
		this.dbg('init');
		this.afAuth.authState
			.subscribe(user => this.store.dispatch(new Login.Check(user)))
	}

	get memberSubject() {
		if (this._memberSubject.isStopped)							// start a new Subject
			this._memberSubject = new BehaviorSubject(null as firebase.auth.AdditionalUserInfo | null);
		return this._memberSubject;
	}

	get auth() {
		return this.afAuth.authState
			.pipe(take(1))
			.toPromise();
	}

	private async authSuccess(ctx: StateContext<IAuthState>, user: firebase.User | null, credential: firebase.auth.AuthCredential | null) {
		if (user) {
			if (credential) {														// have we been redirected here, via credential?
				const response = await user.linkWithCredential(credential);
				ctx.patchState({ info: response.additionalUserInfo });
			}
		}
		else ctx.dispatch(new Event.Failed(new Error('No User information available')))
	}

	/** Commands */
	@Action(Login.Check)														// check Authentication status
	private checkSession(ctx: StateContext<IAuthState>, { user }: Login.Check) {
		this.dbg('%s', user ? `${user.displayName} is logged in` : 'not logged in');

		if (isNull(user) && isNull(this.user))
			this.navigate.route(ROUTE.login);						// redirect to LoginComponent

		if (isNull(user) && !isNull(this.user))				// TODO: does this affect OAuth logins
			ctx.dispatch(new Login.Out());							// User logged-out

		if (!isNull(user) && isNull(this.user)) {
			this.user = user;														// stash the Auth User
			ctx.dispatch(new Event.Success(user));			// User logged-in
		}
	}

	/**
	 * We allow Users to signIn using multiple authentication providers by linking auth provider credentials to an existing user account.  
	 * Users are identifiable by the same Firebase User ID regardless of the authentication provider they used to signIn.  
	 * For example, a user who signed-in with a password can link a Google account and signIn with either method in the future.  
	 */
	@Action(Login.Credential)													// attempt to link multiple providers
	private async loginCredential(ctx: StateContext<IAuthState>, { link }: Login.Credential) {
		const methods = await this.afAuth.fetchSignInMethodsForEmail(link.email);

		switch (methods[0]) {														// check the first-method
			case auth.EmailAuthProvider.EMAIL_PASSWORD_SIGN_IN_METHOD:
				let password = prompt('Please enter the password') || '';
				ctx.dispatch(new Login.Email(link.email, password, 'signIn', link.credential))
				break;

			case auth.EmailAuthProvider.EMAIL_LINK_SIGN_IN_METHOD:
				ctx.dispatch(new Login.Link(link.emailLink!));
				break;

			default:
				const [method, authProvider] = getAuthProvider(methods[0]);
				switch (method) {
					case Auth.METHOD.identity:
					case Auth.METHOD.oauth:
						ctx.dispatch(new Login.Identity(authProvider as firebase.auth.AuthProvider, link.credential));
						break;
				}
		}
	}

	/** Attempt to signIn User via authentication by a federated identity provider */
	@Action(Login.Identity)														// process signInWithPopup()
	private async loginIdentity(ctx: StateContext<IAuthState>, { authProvider, credential }: Login.Identity) {
		try {
			const response = await this.afAuth.signInWithPopup(authProvider);

			if (!credential)
				ctx.patchState({ info: response.additionalUserInfo, credential: response.credential });
			this.authSuccess(ctx, response.user, credential);

		} catch (error) {
			ctx.dispatch(new Event.Failed(error));
		}
	}

	/** Attempt to signIn User via authentication with a Custom Token */
	@Action(Login.Token)
	private async loginToken(ctx: StateContext<IAuthState>, { token, user, prefix }: Login.Token) {
		const additionalUserInfo: firebase.auth.AdditionalUserInfo = {
			isNewUser: false,
			providerId: getProviderId(prefix),
			profile: user,
		}
		ctx.patchState({ info: additionalUserInfo });

		this.afAuth.signInWithCustomToken(token)
			.then(response => ctx.dispatch(new Event.Setup(response.user!)))
			.catch(error => this.dbg('failed: %j', error.toString()));
	}

	/** Attempt to signIn User via an emailAddress / Password combination. */
	@Action(Login.Email)															// process signInWithEmailAndPassword
	private loginEmail(ctx: StateContext<IAuthState>, { email, password, method, credential }: Login.Email) {
		type TEmailMethod = 'signInWithEmailAndPassword' | 'createUserWithEmailAndPassword';
		const thisMethod = `${method}WithEmailAndPassword` as TEmailMethod;
		this.dbg('loginEmail: %s', method);

		try {
			return this.afAuth[thisMethod](email, password)
				.then(response => this.authSuccess(ctx, response.user, credential))
				.catch(async error => {
					switch (error.code) {
						case 'auth/user-not-found':				// need to 'create' first
							return ctx.dispatch(new Login.Email(email, password, 'createUser'));

						default:
							return ctx.dispatch(new Event.Failed(error));
					}
				})
		} catch (error) {
			return ctx.dispatch(new Event.Failed(error));
		}
	}

	/** Attempt to signIn User anonymously */
	@Action(Login.Anon)
	private loginAnon(ctx: StateContext<IAuthState>) {
		return this.afAuth.signInAnonymously()
			.catch(error => ctx.dispatch(new Event.Failed(error)));
	}

	/** Attempt to signIn User via a link sent to their emailAddress */
	@Action(Login.Link)
	private async loginLink(ctx: StateContext<IAuthState>, { link, credential }: Login.Link) {
		const localItem = 'emailForSignIn';

		if (this.afAuth.isSignInWithEmailLink(link)) {
			const email = getLocalStore<string>(localItem) ||
				prompt('Please provide your email for confirmation') ||
				'';

			const response = await this.afAuth.signInWithEmailLink(email, link);
			delLocalStore(localItem);

			if (credential)
				this.authSuccess(ctx, response.user, response.credential);
			ctx.dispatch(new Event.Success(response.user!));
		}
		else this.snack.error('Not a valid link-address');
	}

	@Action(Login.Out)																// process signOut()
	private logout(ctx: StateContext<IAuthState>) {
		this.user = null;																// reset state
		this.afAuth.signOut()
			.then(_ => ctx.dispatch(new Login.Off()))
		return;
	}

	/** Events */
	@Action(Event.Success)														// on each Event.Success, fetch /member collection
	private async onMember(ctx: StateContext<IAuthState>, { user }: Event.Success) {
		const query: IQuery = { where: addWhere(FIELD.uid, user.uid) };
		const currUser = await this.afAuth.currentUser;

		if (currUser) {
			this.sync.on(COLLECTION.attend, query);
			this.sync.on(COLLECTION.member, query)			// wait for /member snap0 
				.then(_ => this._memberSubject.next(ctx.getState().info))
				.then(_ => this._memberSubject.complete())
				.then(_ => this.isAdmin())
				.then(isAdmin => {												// if on "/" or "/login", redirect to "/attend" or "/zoom"
					if (['/', `/${ROUTE.login}`].includes(this.navigate.url))
						this.navigate.route(isAdmin ? ROUTE.zoom : ROUTE.attend)
				})
		}
	}

	@Action(Event.Info)
	private async authInfo(ctx: StateContext<IAuthState>, { info }: Event.Info) {
		ctx.patchState(info);
	}

	@Action(Login.Other)															// behalf of another User
	private(ctx: StateContext<IAuthState>, { alias }: Login.Other) {
		const currUser = ctx.getState().current;
		const loginUser = ctx.getState().user;
		const loginAlias = (ctx.getState().token) && ctx.getState().token!.claims.claims.alias;
		const loginUID = loginUser?.uid as string;

		if (!currUser && !alias)
			return;																			// nothing to do
		if (alias && alias === loginAlias)
			return;																			// already auth'd

		if (!alias) {
			this.syncUID(loginUID);											// reset /member and /attend listeners
			return;
		}

		/**
		 * get /admin/register to lookup the <uid> for the supplied <alias>.  
		 * establish a listener for the loginUID and the register uid
		 */
		this.store.selectOnce<TStateSlice<IRegister>>(state => state[SLICE.admin])
			.pipe(
				map(admin => admin[STORE.register]),			// get the Register segment
				map(table => table.find(row => getPath(row, 'user.customClaims.alias') === alias)),
			)
			.subscribe(reg => {
				if (reg?.user)
					this.syncUID([loginUID, reg.user.uid]);

				ctx.patchState({ current: reg && reg.user || null });
			})
	}

	private syncUID(uids?: string | string[] | null) {
		if (uids) {
			this.sync.off(COLLECTION.member);						// unsubscribe from /member
			this.sync.off(COLLECTION.attend);						// unsubscribe from /attend

			const where = addWhere(FIELD.uid, uids, isArray(uids) ? 'in' : '==');
			this.sync.on(COLLECTION.member, { where });	// re-subscribe to /member, with supplied UIDs
			this.sync.on(COLLECTION.attend, { where });	// re-subscribe to /attend, with supplied UIDs
		}
	}

	@Action([Event.Setup, Event.Success])
	private setUserStateOnSuccess(ctx: StateContext<IAuthState>, { user }: Event.Setup) {
		if (this.afAuth.currentUser) {
			const clone = cloneObj(user);								// safe copy of User

			if (!clone.email) {
				this.snack.error('Must have a valid email address');
				return ctx.dispatch(new Login.Out());
			}
			ctx.patchState({ user: clone, current: clone });
			ctx.dispatch(new Event.Token());
		}
	}

	@Action(Event.Token)															// fetch latest IdToken
	private async setToken(ctx: StateContext<IAuthState>) {
		const currUser = await this.afAuth.currentUser;

		if (currUser) {
			const token = await currUser.getIdTokenResult(true)
			const roles = getPath<string[]>({ ...token }, 'claims.claims.roles') || [];
			ctx.patchState({ token });
			this.dbg('customClaims: %j', (ctx.getState().token as firebase.auth.IdTokenResult).claims.claims);

			if (roles.includes(Auth.ROLE.admin)) {
				this.sync.on(COLLECTION.admin, undefined,		// watch all /admin and /member/status  into one Observable
					[COLLECTION.member, { where: addWhere(FIELD.store, STORE.status) }]);
				// this.dbg('tokenRoute: ', this.navigate.url);
				// this.navigate.route(ROUTE.zoom);
			} else {
				this.sync.off(COLLECTION.admin);
				this.navigate.route(ROUTE.attend);
			}
		}
	}

	private async isAdmin() {
		const currUser = await this.afAuth.currentUser;
		if (currUser) {
			const token = await currUser.getIdTokenResult(true);
			const roles = getPath<string[]>({ ...token }, 'claims.claims.roles') || [];
			return roles.includes(Auth.ROLE.admin);
		}
		return false;
	}

	@Action([Event.Failed, Login.Off])
	private notLogin(ctx: StateContext<IAuthState>, { error }: Event.Failed) {
		this.sync.off();												// disconnect all Listeners

		if (error) {
			this.dbg('logout: %j', error);
			this.snack.open(error.message);

			if (error.code === 'auth/account-exists-with-different-credential')
				return ctx.dispatch(new Login.Credential(error));
		}

		ctx.setState({ user: null, token: null, info: null, credential: null, current: null, });
		this.navigate.route(ROUTE.login);
	}
}