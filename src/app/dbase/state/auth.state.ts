import { MatSnackBar } from '@angular/material/snack-bar';
import { auth as fb } from 'firebase/app';
import { User, IdTokenResult, AuthCredential } from '@firebase/auth-types';
import { AngularFireAuth } from 'angularfire2/auth';

import { take, tap } from 'rxjs/operators';
import { State, Selector, StateContext, Action, NgxsOnInit } from '@ngxs/store';
import { Navigate } from '@ngxs/router-plugin';
import { SLICE, TruncMember, TruncAttend } from '@dbase/state/store.define';

import { IAuthState, CheckSession, LoginSuccess, LoginRedirect, LoginFailed, LogoutSuccess, LoginSocial, Logout, LoginToken, LoginEmail, LoginLink, AuthProfile } from '@dbase/state/auth.define';
import { getAuthProvider, isActive } from '@dbase/auth/auth.library';
import { SyncService } from '@dbase/sync/sync.service';
import { COLLECTION, FIELD } from '@dbase/data/data.define';
import { IQuery } from '@dbase/fire/fire.interface';

import { ROUTE } from '@route/route.define';
import { dbg } from '@lib/logger.library';

@State<IAuthState>({
	name: SLICE.auth,
	defaults: {
		userInfo: null,
		userToken: null,
		userProfile: null,
	}
})
export class AuthState implements NgxsOnInit {
	private dbg: Function = dbg.bind(this);

	constructor(private afAuth: AngularFireAuth, private sync: SyncService, private snack: MatSnackBar) { }

	ngxsOnInit(ctx: StateContext<IAuthState>) {
		this.dbg('init');
		ctx.dispatch(new CheckSession());						// Dispatch CheckSession on start
	}

	private async authSuccess(ctx: StateContext<IAuthState>, user: User | null, credential: AuthCredential) {
		if (user) {
			if (credential) {													// have we been redirected here, via credential?
				const response = await user.linkAndRetrieveDataWithCredential(credential);
				ctx.patchState({ userProfile: response.additionalUserInfo });
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
	checkSession(ctx: StateContext<IAuthState>) {
		const auth = ctx.getState();

		if (!isActive(auth)) {											// check their prior auth-status
			ctx.dispatch(new LoginRedirect());
			return;
		}

		return this.afAuth.authState								// then check to see if still authenticated
			.pipe(
				take(1),
				tap(user => {
					this.dbg('%s', user ? `${user.displayName} is logged in` : 'not logged in');
					if (user && auth.userInfo) {
						// const [type, authProvider, authCredential] = getAuthProvider(auth.userInfo.providerId, auth.userToken);

						// if (authCredential) {								// TODO: use authCredential to get additionalUserInfo
						// }
						ctx.dispatch(new LoginSuccess(user));
					}
					else ctx.dispatch(new Logout());
				})
			);
	}

	@Action(LoginLink)														// attempt to link multiple providers
	async loginLink(ctx: StateContext<IAuthState>, { link }: LoginLink) {
		const methods = await this.afAuth.auth.fetchSignInMethodsForEmail(link.email);

		if (methods[0] === 'password') {
			let password = window.prompt('Please enter the password') || '';
			ctx.dispatch(new LoginEmail(link.email, password, 'signIn', link.credential))
		} else {
			const [type, provider] = getAuthProvider(methods[0]);
			switch (type) {
				case 'social':
					ctx.dispatch(new LoginSocial(provider, link.credential));
					break;
			}
		}
	}

	@Action(LoginSocial)														// process signInWithPopup()
	loginSocial(ctx: StateContext<IAuthState>, { authProvider, credential }: LoginSocial) {
		return this.afAuth.auth.signInWithPopup(authProvider)
			.then(response => {
				if (!credential)
					ctx.patchState({ userProfile: response.additionalUserInfo });
				this.authSuccess(ctx, response.user, credential);
			})
			.catch(error => ctx.dispatch(new LoginFailed(error)))
	}

	@Action(LoginEmail)															// process signInWithEmailAndPassword
	loginEmail(ctx: StateContext<IAuthState>, { email, password, method, credential }: LoginEmail) {
		type TEmailMethod = 'signInWithEmailAndPassword' | 'createUserWithEmailAndPassword';
		const m = `${method}WithEmailAndPassword` as TEmailMethod;
		this.dbg('loginEmail: %s', method);

		return this.afAuth.auth[m](email, password)
			.then(response => this.authSuccess(ctx, response.user, credential))
			.catch(async error => {
				switch (error.code) {
					case 'auth/user-not-found':				// need to 'create' first
						return ctx.dispatch(new LoginEmail(email, password, 'createUser'));

					default:
						return ctx.dispatch(new LoginFailed(error));
				}
			})
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
		const query: IQuery = { where: { fieldPath: FIELD.key, value: user.uid } };

		if (this.afAuth.auth.currentUser) {
			this.sync.on(COLLECTION.Attend, SLICE.attend, query);
			this.sync.on(COLLECTION.Member, SLICE.member, query)	// wait for /member snap0 
				.then(_ => ctx.dispatch(new AuthProfile()))					// check for AdditionalUserInfo
				.then(_ => ctx.dispatch(new Navigate([ROUTE.attend])))
		}
	}

	@Action(LoginSuccess)														// on each LoginSuccess, fetch latest UserInfo, IdToken
	setUserStateOnSuccess(ctx: StateContext<IAuthState>, { user }: LoginSuccess) {
		this.snack.dismiss();
		if (this.afAuth.auth.currentUser) {
			this.afAuth.auth.currentUser.getIdTokenResult()
				.then(userToken => ctx.patchState({ userInfo: user, userToken }))
				.then(_ => this.dbg('customClaims: %j', (ctx.getState().userToken as IdTokenResult).claims.claims))
		}
	}

	@Action(LoginToken)															// fetch latest IdToken
	setToken(ctx: StateContext<IAuthState>) {
		(this.afAuth.auth.currentUser as User).getIdTokenResult(true)
			.then(userToken => ctx.patchState({ userToken }))
			.then(_ => this.dbg('customClaims: %j', (ctx.getState().userToken as IdTokenResult).claims.claims))
	}

	@Action(LoginRedirect)
	onLoginRedirect(ctx: StateContext<IAuthState>) {//	/member

		this.dbg('onLoginRedirect, navigating to /login');
		ctx.dispatch(new Navigate([ROUTE.login]));
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
		ctx.setState({ userInfo: null, userToken: null, userProfile: null });
		ctx.dispatch(new LoginRedirect());
	}
}