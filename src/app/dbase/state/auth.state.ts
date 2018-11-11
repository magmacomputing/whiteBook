import { NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AngularFireAuth } from '@angular/fire/auth';

// import { Navigate } from '@ngxs/router-plugin';
import { User, IdTokenResult, AuthCredential, AuthProvider } from '@firebase/auth-types';
import { take, tap } from 'rxjs/operators';
import { ROUTE } from '@route/route.define';

import { State, Selector, StateContext, Action, NgxsOnInit } from '@ngxs/store';
import { SLICE, TruncMember, TruncAttend } from '@dbase/state/store.define';
import { IAuthState, CheckSession, LoginSuccess, LoginRedirect, LoginFailed, LogoutSuccess, LoginIdentity, Logout, LoginToken, LoginEmail, LoginLink, LoginInfo, LoginOAuth, LoginSetup } from '@dbase/state/auth.define';

import { getAuthProvider, isActive } from '@dbase/auth/auth.library';
import { SyncService } from '@dbase/sync/sync.service';
import { COLLECTION, FIELD } from '@dbase/data/data.define';
import { IQuery } from '@dbase/fire/fire.interface';

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
	private dbg: Function = dbg.bind(this);

	constructor(private afAuth: AngularFireAuth, private sync: SyncService, private snack: MatSnackBar,
		private router: Router, private zone: NgZone) { }

	ngxsOnInit(ctx: StateContext<IAuthState>) {
		this.dbg('init');
		this.afAuth.authState
			.subscribe(_ => ctx.dispatch(new CheckSession(this.router.url)))
	}

	private async authSuccess(ctx: StateContext<IAuthState>, user: User | null, credential: AuthCredential) {
		if (user) {
			if (credential) {													// have we been redirected here, via credential?
				const response = await user.linkAndRetrieveDataWithCredential(credential);
				ctx.patchState({ info: response.additionalUserInfo });
			}
			ctx.dispatch(new LoginSuccess(user));
		}
		else ctx.dispatch(new LoginFailed(new Error('No User information available')))
	}

	/** Selectors */
	@Selector()
	static auth(state: IAuthState) {
		return state;
	}

	/** Commands */
	@Action(CheckSession)													// on first connect, check if still logged-on
	checkSession(ctx: StateContext<IAuthState>, { url }: CheckSession) {
		this.dbg('url: %s', url);
		if (url.split('?')[0] == ROUTE.oauth)
			return;																		// intercept the redirect-to-login page

		return this.afAuth.authState								// then check to see if still authenticated
			.pipe(
				take(1),
				tap(async user => {
					this.dbg('%s', user ? `${user.displayName} is logged in` : 'not logged in');
					this.dbg('')
					ctx.dispatch(user
						? new LoginSuccess(user)
						: new Logout()
					)
				})
			);
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
	async loginToken(ctx: StateContext<IAuthState>, { token }: LoginOAuth) {

		try {
			const response = await this.afAuth.auth.signInWithCustomToken(token);

			ctx.dispatch(new LoginSetup(response.user!));
			ctx.patchState({ info: response.additionalUserInfo, credential: response.credential });

		} catch (error) {
			this.dbg('failed: %j', error.toString());
		}
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
		await this.afAuth.auth.signOut();

		ctx.dispatch(new LogoutSuccess());
		return;
	}

	/** Events */
	@Action(LoginSuccess)														// on each LoginSuccess, fetch /member collection
	onMember(ctx: StateContext<IAuthState>, { user }: LoginSuccess) {
		const query: IQuery = { where: { fieldPath: FIELD.uid, value: user.uid } };

		if (this.afAuth.auth.currentUser) {
			this.sync.on(COLLECTION.Attend, SLICE.attend, query);
			this.sync.on(COLLECTION.Member, SLICE.member, query)	// wait for /member snap0 
				.then(_ => ctx.dispatch(new LoginInfo()))						// check for AdditionalUserInfo
				.then(_ => this.zone.run(() => this.router.navigateByUrl(ROUTE.attend)))
			// .then(_ => ctx.dispatch(new Navigate([ROUTE.attend])))
		}
	}

	@Action([LoginSetup, LoginSuccess])							// on each LoginSuccess, fetch latest UserInfo, IdToken
	setUserStateOnSuccess(ctx: StateContext<IAuthState>, { user }: LoginSetup) {
		this.snack.dismiss();
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

	@Action(LoginRedirect)
	onLoginRedirect(ctx: StateContext<IAuthState>) {//	/member
		this.dbg('onLoginRedirect, navigating to /login');
		// ctx.dispatch(new Navigate([ROUTE.login]));
		this.zone.run(() => this.router.navigateByUrl(ROUTE.login));
	}

	@Action([LoginFailed, LogoutSuccess])
	setUserStateOnFailure(ctx: StateContext<IAuthState>, { error }: LoginFailed) {
		this.sync.off(COLLECTION.Member, TruncMember);
		this.sync.off(COLLECTION.Attend, TruncAttend);
		this.snack.dismiss();

		if (error) {
			this.dbg('logout: %j', error);
			this.snack.open(error.message);

			if (error.code === 'auth/account-exists-with-different-credential')
				return ctx.dispatch(new LoginLink(error));
		}
		ctx.setState({ user: null, token: null, info: null, credential: null });
		ctx.dispatch(new LoginRedirect());
	}
}