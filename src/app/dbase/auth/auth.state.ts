import { ApplicationRef } from '@angular/core';
import { AngularFireAuth } from 'angularfire2/auth';
import { User, UserInfo, AuthProvider, IdTokenResult } from '@firebase/auth-types';

import { take, tap } from 'rxjs/operators';
import { State, Selector, StateContext, Action, Store, NgxsOnInit } from '@ngxs/store';
import { Navigate } from '@ngxs/router-plugin';
import { SLICE } from '@state/state.define';
import { IAuthState, CheckSession, LoginSuccess, LoginRedirect, LoginFailed, LogoutSuccess, LoginSocial, Logout, LoginToken } from '@dbase/auth/auth.define';

import { IProvider } from '@func/app/app.interface';
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

	constructor(private afAuth: AngularFireAuth, private ref: ApplicationRef) {
		this.dbg('new');
	}

	ngxsOnInit(ctx: StateContext<IAuthState>) {
		this.dbg('onInit');
		ctx.dispatch(new CheckSession());								/** Dispatch CheckSession on start */
	}

	/** Selectors */
	@Selector()
	static getUser(state: IAuthState) {
		return state;
	}

	/** Commands */
	@Action(CheckSession)
	checkSession(ctx: StateContext<IAuthState>) {
		this.dbg('checkSession');
		return this.afAuth.authState.pipe(
			take(1),
			tap(user => {
				this.dbg('%s', user ? `${user.displayName} is logged in` : 'not logged in');
				if (user)
					ctx.dispatch(new LoginSuccess(user))
			})
		);
	}

	@Action(LoginSocial)
	loginSocial(ctx: StateContext<IAuthState>, { authProvider }: LoginSocial) {
		return this.afAuth.auth.signInWithPopup(authProvider)
			.then((response: { user: User }) => ctx.dispatch(new LoginSuccess(response.user)))
			.catch(error => ctx.dispatch(new LoginFailed(error)))
	}

	@Action(Logout)
	logout(ctx: StateContext<IAuthState>) {
		return this.afAuth.auth.signOut()
			.then(_ => ctx.dispatch(new LogoutSuccess()))
	}

	/** Events */
	@Action(LoginSuccess)
	onLoginSuccess(ctx: StateContext<IAuthState>) {
		this.dbg('onLoginSuccess, navigating to /attend');
		ctx.dispatch(new Navigate(['/attend']));
		this.ref.tick();
	}

	@Action(LoginSuccess)
	setUserStateOnSuccess(ctx: StateContext<IAuthState>, { user }: LoginSuccess) {
		return ctx.patchState({ userInfo: user });
	}

	@Action(LoginToken)
	setToken(ctx: StateContext<IAuthState>, { token }: LoginToken) {
		this.dbg('token: %j', token && token.claims);
		return ctx.patchState({ userToken: token });
	}

	@Action(LoginRedirect)
	onLoginRedirect(ctx: StateContext<IAuthState>) {
		this.dbg('onLoginRedirect, navigating to /login');
		ctx.dispatch(new Navigate(['/login']));
		this.ref.tick();
	}

	@Action([LoginFailed, LogoutSuccess])
	setUserStateOnFailure(ctx: StateContext<IAuthState>) {
		ctx.setState({ userInfo: null, userToken: null });
		ctx.dispatch(new LoginRedirect());
		this.ref.tick();
	}
}