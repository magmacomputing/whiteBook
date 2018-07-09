import { MatSnackBar } from '@angular/material/snack-bar';
import { User, IdTokenResult, AuthCredential, UserCredential } from '@firebase/auth-types';
import { AngularFireAuth } from 'angularfire2/auth';

import { take, tap } from 'rxjs/operators';
import { State, Selector, StateContext, Action, NgxsOnInit } from '@ngxs/store';
import { Navigate } from '@ngxs/router-plugin';
import { SLICE } from '@dbase/state/store.define';

import { IAuthState, CheckSession, LoginSuccess, LoginRedirect, LoginFailed, LogoutSuccess, LoginSocial, Logout, LoginToken, LoginEmail, LoginLink } from '@dbase/state/auth.define';
import { getAuthProvider, getAuthCredential } from '@dbase/auth/auth.library';
import { SyncService } from '@dbase/sync/sync.service';
import { COLLECTION, FIELD, STORE } from '@dbase/data/data.define';
import { IQuery } from '@dbase/fire/fire.interface';

import { dbg } from '@lib/logger.library';

@State<IAuthState>({
	name: SLICE.auth,
	defaults: {
		userInfo: null,
		userToken: null,
	}
})
export class AuthState implements NgxsOnInit {
	private dbg: Function = dbg.bind(this);

	constructor(private afAuth: AngularFireAuth, private sync: SyncService, private snack: MatSnackBar) { }

	ngxsOnInit(ctx: StateContext<IAuthState>) {
		this.dbg('init');
		ctx.dispatch(new CheckSession());								/** Dispatch CheckSession on start */
	}

	private authSuccess(ctx: StateContext<IAuthState>, user: User | null, credential: AuthCredential) {
		if (user) {
			if (credential)													// have we been redirected here, via credential?
				user.linkAndRetrieveDataWithCredential(credential);
			ctx.dispatch(new LoginSuccess(user));
		}
		else ctx.dispatch(new LoginFailed(new Error('No User information available')))
	}

	/** Selectors */
	@Selector()
	static getUser(state: IAuthState) {
		return state;
	}

	/** Commands */
	@Action(CheckSession)														// on first connect, check if still logged-on
	checkSession(ctx: StateContext<IAuthState>) {
		this.dbg('checkSession');
		return this.afAuth.authState
			.pipe(
				take(1),
				tap(user => {
					this.dbg('%s', user ? `${user.displayName} is logged in` : 'not logged in');
					if (user)
						ctx.dispatch(new LoginSuccess(user));
				})
			);
	}

	@Action(LoginLink)
	async loginLink(ctx: StateContext<IAuthState>, { link }: LoginLink) {
		const methods = await this.afAuth.auth.fetchSignInMethodsForEmail(link.email);

		this.dbg('methods: %j', methods);
		if (methods[0] === 'password') {
			let password = window.prompt('Please enter the password') || '';
			ctx.dispatch(new LoginEmail(link.email, password, 'signIn', link.credential))
		} else {
			const provider = getAuthProvider(methods[0]);
			ctx.dispatch(new LoginSocial(provider, link.credential));
		}
	}

	@Action(LoginSocial)														// process signInWithPopup()
	loginSocial(ctx: StateContext<IAuthState>, { authProvider, credential }: LoginSocial) {
		return this.afAuth.auth.signInWithPopup(authProvider)
			.then(response => this.authSuccess(ctx, response.user, credential))
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
	logout(ctx: StateContext<IAuthState>) {
		return this.afAuth.auth.signOut()
			.then(_ => ctx.dispatch(new LogoutSuccess()))
	}

	/** Events */
	@Action(LoginSuccess)														// on each LoginSuccess, fetch /member collection
	onMember(ctx: StateContext<IAuthState>, { user }: LoginSuccess) {
		const query: IQuery = { where: { fieldPath: FIELD.uid, opStr: '==', value: user.uid } };
		const segment = `/${STORE.attend}`;

		// TODO:  add in customClaims/[allow]
		this.sync.on(COLLECTION.Attend, SLICE.attend, query);
		this.sync.on(COLLECTION.Member, SLICE.member, query)
			.then(_ => this.dbg('navigate: %s', segment))
			.then(_ => ctx.dispatch(new Navigate([segment])))	// wait for /member snap0 
	}

	@Action(LoginSuccess)														// on each LoginSuccess, fetch latest UserInfo, IdToken
	setUserStateOnSuccess(ctx: StateContext<IAuthState>, { user }: LoginSuccess) {
		this.snack.dismiss();
		(this.afAuth.auth.currentUser as User).getIdTokenResult()
			.then(tokenResult => ctx.patchState({ userInfo: user, userToken: tokenResult }))
			.then(_ => this.dbg('claims: %j', (ctx.getState().userToken as IdTokenResult).claims))
	}

	@Action(LoginToken)															// fetch latest IdToken
	setToken(ctx: StateContext<IAuthState>) {
		(this.afAuth.auth.currentUser as User).getIdTokenResult(true)
			.then(tokenResult => ctx.patchState({ userToken: tokenResult }))
			.then(_ => this.dbg('customClaims: %j', (ctx.getState().userToken as IdTokenResult).claims.claims))
	}

	@Action(LoginRedirect)
	onLoginRedirect(ctx: StateContext<IAuthState>) {
		this.dbg('onLoginRedirect, navigating to /login');
		ctx.dispatch(new Navigate(['/login']));
	}

	@Action([LoginFailed, LogoutSuccess])
	setUserStateOnFailure(ctx: StateContext<IAuthState>, { error }: LoginFailed) {
		this.sync.off(COLLECTION.Member);
		this.sync.off(COLLECTION.Attend);
		this.snack.dismiss();

		if (error) {
			this.dbg('logout: %j', error);
			this.snack.open(error.message);

			if (error.code === 'auth/account-exists-with-different-credential')
				return ctx.dispatch(new LoginLink(error));
		}
		ctx.setState({ userInfo: null, userToken: null });
		ctx.dispatch(new LoginRedirect());
	}
}