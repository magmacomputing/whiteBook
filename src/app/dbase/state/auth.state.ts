import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/auth';
import firebase from 'firebase/app';

import { State, StateContext, Action, Store } from '@ngxs/store';
import { BehaviorSubject } from 'rxjs';
import { map, take } from 'rxjs/operators';

import { AuthSlice, LoginAction, LoginEvent } from '@dbase/state/auth.action';
import { TStateSlice, SLICE } from '@dbase/state/state.define';

import { SnackService } from '@service/material/snack.service';
import { getAuthProvider, getProviderId } from '@service/auth/auth.library';

import { ROUTE } from '@route/router/route.define';
import { NavigateService } from '@route/router/navigate.service';

import { SyncService } from '@dbase/sync/sync.service';
import { COLLECTION, FIELD, STORE, auth } from '@dbase/data.define';
import type { Register } from '@dbase/data.schema';
import { fire } from '@dbase/fire/fire.library';

import { WebStore, prompt } from '@library/browser.library';
import { getPath, cloneObj } from '@library/object.library';
import { isNull, isArray } from '@library/type.library';
import { dbg } from '@library/logger.library';

@Injectable()
@State<AuthSlice>({
	name: SLICE.auth,
	defaults: {
		user: null,																			// firebase.User object
		token: null,																		// oauth token
		info: null,																			// Provider additionalInfo
		credential: null,																// authenticated user's credential
		current: null,																	// the effective User (used in 'on-behalf' mode)
	}
})
export class AuthState {
	private dbg = dbg(this);
	private user: firebase.User | null = null;
	private _memberSubject: BehaviorSubject<AuthSlice["info"]> = this.newSubject();

	constructor(private afAuth: AngularFireAuth, private sync: SyncService, private store: Store, private snack: SnackService, private navigate: NavigateService) { this.init(); }

	private init() {
		this.dbg('init');
		this.afAuth.authState
			.subscribe(user => this.store.dispatch(new LoginAction.Check(user)))
	}

	private newSubject() {
		return new BehaviorSubject(null as AuthSlice["info"]);
	}

	get memberSubject() {
		if (this._memberSubject?.isStopped ?? true)			// start a new Subject
			this._memberSubject = this.newSubject();
		return this._memberSubject;
	}

	get auth() {
		return this.afAuth.authState
			.pipe(take(1))
			.toPromise();
	}

	private async authSuccess(ctx: StateContext<AuthSlice>, user: firebase.User | null, credential: AuthSlice["credential"]) {
		if (user) {
			if (credential) {															// have we been redirected here, via credential?
				const response = await user.linkWithCredential(credential);
				ctx.patchState({ info: response.additionalUserInfo });
			}
		}
		else ctx.dispatch(new LoginEvent.Failed(new Error('No User information available')))
	}

	/** Commands */
	@Action(LoginAction.Check)												// check Authentication status
	private checkSession(ctx: StateContext<AuthSlice>, { user }: LoginAction.Check) {
		this.dbg('%s', user ? `${user.displayName} is logged in` : 'not logged in');

		if (isNull(user) && isNull(this.user))
			this.navigate.route(ROUTE.Login);							// redirect to LoginComponent

		if (isNull(user) && !isNull(this.user))					// TODO: does this affect OAuth logins
			ctx.dispatch(new LoginAction.Out());					// User logged-out

		if (!isNull(user) && isNull(this.user)) {
			this.user = user;															// stash the Auth User
			ctx.dispatch(new LoginEvent.Success(user));		// User logged-in
		}
	}

	/**
	 * We allow Users to signIn using multiple authentication providers by linking auth provider credentials to an existing user account.  
	 * Users are identifiable by the same Firebase User ID regardless of the authentication provider they used to signIn.  
	 * For example, a user who signed-in with a password can link a Google account and signIn with either method in the future.  
	 */
	@Action(LoginAction.Credential)													// attempt to link multiple providers
	private async loginCredential(ctx: StateContext<AuthSlice>, { link }: LoginAction.Credential) {
		const methods = await this.afAuth.fetchSignInMethodsForEmail(link.email);

		switch (methods[0]) {														// check the first-method
			case firebase.auth.EmailAuthProvider.EMAIL_PASSWORD_SIGN_IN_METHOD:
				let password = prompt('Please enter the password') || '';
				ctx.dispatch(new LoginAction.Email(link.email, password, 'signIn', link.credential))
				break;

			case firebase.auth.EmailAuthProvider.EMAIL_LINK_SIGN_IN_METHOD:
				ctx.dispatch(new LoginAction.Link(link.emailLink!));
				break;

			default:
				const [method, authProvider] = getAuthProvider(methods[0]);
				switch (method) {
					case auth.METHOD.Identity:
					case auth.METHOD.Oauth:
						ctx.dispatch(new LoginAction.Identity(authProvider as firebase.auth.AuthProvider, link.credential));
						break;
				}
		}
	}

	/** Attempt to signIn User via authentication by a federated identity provider */
	@Action(LoginAction.Identity)														// process signInWithPopup()
	private async loginIdentity(ctx: StateContext<AuthSlice>, { authProvider, credential }: LoginAction.Identity) {
		try {
			const response = await this.afAuth.signInWithPopup(authProvider);

			if (!credential)
				ctx.patchState({ info: response.additionalUserInfo, credential: response.credential });
			this.authSuccess(ctx, response.user, credential);

		} catch (error) {
			ctx.dispatch(new LoginEvent.Failed(error));
		}
	}

	/** Attempt to signIn User via authentication with a Custom Token */
	@Action(LoginAction.Token)
	private async loginToken(ctx: StateContext<AuthSlice>, { token, user, prefix }: LoginAction.Token) {
		const additionalUserInfo: AuthSlice["info"] = {
			isNewUser: false,
			providerId: getProviderId(prefix),
			profile: user,
		}
		ctx.patchState({ info: additionalUserInfo });

		this.afAuth.signInWithCustomToken(token)
			.then(response => ctx.dispatch(new LoginEvent.Setup(response.user!)))
			.catch(error => this.dbg('failed: %j', error.toString()));
	}

	/** Attempt to signIn User via an emailAddress / Password combination. */
	@Action(LoginAction.Email)															// process signInWithEmailAndPassword
	private loginEmail(ctx: StateContext<AuthSlice>, { email, password, method, credential }: LoginAction.Email) {
		type TEmailMethod = 'signInWithEmailAndPassword' | 'createUserWithEmailAndPassword';
		const thisMethod = `${method}WithEmailAndPassword` as TEmailMethod;
		this.dbg('loginEmail: %s', method);

		try {
			return this.afAuth[thisMethod](email, password)
				.then(response => this.authSuccess(ctx, response.user, credential))
				.catch(async error => {
					switch (error.code) {
						case 'auth/user-not-found':				// need to 'create' first
							return ctx.dispatch(new LoginAction.Email(email, password, 'createUser'));

						default:
							return ctx.dispatch(new LoginEvent.Failed(error));
					}
				})
		} catch (error) {
			return ctx.dispatch(new LoginEvent.Failed(error));
		}
	}

	/** Attempt to signIn User anonymously */
	@Action(LoginAction.Anon)
	private loginAnon(ctx: StateContext<AuthSlice>) {
		return this.afAuth.signInAnonymously()
			.catch(error => ctx.dispatch(new LoginEvent.Failed(error)));
	}

	/** Attempt to signIn User via a link sent to their emailAddress */
	@Action(LoginAction.Link)
	private async loginLink(ctx: StateContext<AuthSlice>, { link, credential }: LoginAction.Link) {
		const localItem = 'emailForSignIn';

		if (this.afAuth.isSignInWithEmailLink(link)) {
			const email = WebStore.session.get<string>(localItem) ||
				prompt('Please provide your email for confirmation') ||
				'';
			const response = await this.afAuth.signInWithEmailLink(email, link);

			if (credential)
				this.authSuccess(ctx, response.user, response.credential);
			ctx.dispatch(new LoginEvent.Success(response.user!));
		}
		else this.snack.error('Not a valid link-address');
	}

	@Action(LoginAction.Out)												// process signOut()
	private logout(ctx: StateContext<AuthSlice>) {
		this.user = null;															// reset state
		this.afAuth.signOut()
			.then(_ => ctx.dispatch(new LoginAction.Off()))
		return;
	}

	/** Events */
	@Action(LoginEvent.Success)											// on each LoginEvent.Success, fetch /member collection
	private async onMember(ctx: StateContext<AuthSlice>, { user }: LoginEvent.Success) {
		const query: fire.Query = { where: fire.addWhere(FIELD.Uid, user.uid) };
		const currUser = await this.afAuth.currentUser;

		if (currUser) {
			this.sync.on(COLLECTION.Attend, query);
			this.sync.on(COLLECTION.Member, query)			// wait for /member snap0 
				.then(_ => this._memberSubject.next(ctx.getState().info))
				.then(_ => this._memberSubject.complete())
				.then(_ => this.isAdmin())
				.then(isAdmin => {												// if on "/" or "/login", redirect to "/attend" or "/admin"
					if (['/', `/${ROUTE.Login}`].includes(this.navigate.url))
						this.navigate.route(isAdmin ? ROUTE.Admin : ROUTE.Attend)
				})
		}
	}

	@Action(LoginEvent.Info)
	private async authInfo(ctx: StateContext<AuthSlice>, { info }: LoginEvent.Info) {
		ctx.patchState(info);
	}

	@Action(LoginAction.Other)											// behalf of another User
	private(ctx: StateContext<AuthSlice>, { alias }: LoginAction.Other) {
		const currUser = ctx.getState().current;
		const loginUser = ctx.getState().user;
		const loginAlias = ctx.getState().token?.claims?.customClaims?.alias as string;
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
		this.store.selectOnce<TStateSlice<Register>>(state => state[SLICE.admin])
			.pipe(
				map(admin => admin[STORE.Register]),			// get the Register segment
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
			this.sync.off(COLLECTION.Member);						// unsubscribe from /member
			this.sync.off(COLLECTION.Attend);						// unsubscribe from /attend

			const where = fire.addWhere(FIELD.Uid, uids, isArray(uids) ? 'in' : '==');
			this.sync.on(COLLECTION.Member, { where });	// re-subscribe to /member, with supplied UIDs
			this.sync.on(COLLECTION.Attend, { where });	// re-subscribe to /attend, with supplied UIDs
		}
	}

	@Action([LoginEvent.Setup, LoginEvent.Success])
	private setUserStateOnSuccess(ctx: StateContext<AuthSlice>, { user }: LoginEvent.Setup) {
		if (this.afAuth.currentUser) {
			const clone = cloneObj(user);								// safe copy of User

			if (!clone.email) {
				this.snack.error('Must have a valid email address');
				return ctx.dispatch(new LoginAction.Out());
			}
			ctx.patchState({ user: clone, current: clone });
			ctx.dispatch(new LoginEvent.Token());
		}
	}

	@Action(LoginEvent.Token)															// fetch latest IdToken
	private async setToken(ctx: StateContext<AuthSlice>) {
		const currUser = await this.afAuth.currentUser;

		if (currUser) {
			const token = await currUser.getIdTokenResult(true)
			const roles = getPath<string[]>({ ...token }, 'claims.customClaims.roles') || [];
			ctx.patchState({ token });

			this.dbg('customClaims: %j', ctx.getState().token?.claims.customClaims);
			if (roles.includes(auth.ROLE.Admin)) {
				this.sync.on(COLLECTION.Admin, undefined,		// watch all /admin and /member/status  into one stream
					[COLLECTION.Member, { where: fire.addWhere(FIELD.Store, STORE.Status) }]);
			} else {
				this.sync.off(COLLECTION.Admin);
				this.navigate.route(ROUTE.Attend);
			}
		}
	}

	private async isAdmin() {
		const currUser = await this.afAuth.currentUser;
		if (currUser) {
			const token = await currUser.getIdTokenResult(true);
			const roles = getPath<string[]>({ ...token }, 'claims.customClaims.roles') || [];
			return roles.includes(auth.ROLE.Admin);
		}
		return false;
	}

	@Action([LoginEvent.Failed, LoginAction.Off])
	private notLogin(ctx: StateContext<AuthSlice>, { error }: LoginEvent.Failed) {
		this.sync.off();												// disconnect all Listeners

		if (error) {
			this.dbg('logout: %j', error);
			this.snack.open(error.message);

			if (error.code === 'auth/account-exists-with-different-credential')
				return ctx.dispatch(new LoginAction.Credential(error));
		}

		ctx.setState({ user: null, token: null, info: null, credential: null, current: null, });
		this.dbg('about to route: ', ROUTE.Login);
		this.navigate.route(ROUTE.Login);
	}
}