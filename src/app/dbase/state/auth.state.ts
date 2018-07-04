import { ApplicationRef } from '@angular/core';
import { User, IdTokenResult } from '@firebase/auth-types';
import { AngularFireAuth } from 'angularfire2/auth';

import { take, tap } from 'rxjs/operators';
import { State, Selector, StateContext, Action, NgxsOnInit } from '@ngxs/store';
import { Navigate } from '@ngxs/router-plugin';
import { SLICE } from '@dbase/state/store.define';

import { IAuthState, CheckSession, LoginSuccess, LoginRedirect, LoginFailed, LogoutSuccess, LoginSocial, Logout, LoginToken } from '@dbase/state/auth.define';
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

	constructor(private afAuth: AngularFireAuth, private sync: SyncService, private ref: ApplicationRef) { }

	ngxsOnInit(ctx: StateContext<IAuthState>) {
		this.dbg('init');

		ctx.dispatch(new CheckSession());								/** Dispatch CheckSession on start */
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

	@Action(LoginSocial)														// process signInWithPopup()
	loginSocial(ctx: StateContext<IAuthState>, { authProvider }: LoginSocial) {
		return this.afAuth.auth.signInWithPopup(authProvider)
			.then((response: { user: User | null }) => ctx.dispatch(
				response.user
					? new LoginSuccess(response.user)
					: new LoginFailed(new Error('No User information available'))
			))
			.catch(error => ctx.dispatch(new LoginFailed(error)))
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
		// this.ref.tick();
	}

	@Action([LoginFailed, LogoutSuccess])
	setUserStateOnFailure(ctx: StateContext<IAuthState>) {
		this.sync.off(COLLECTION.Member);
		this.sync.off(COLLECTION.Attend);

		ctx.setState({ userInfo: null, userToken: null });
		ctx.dispatch(new LoginRedirect());
		// this.ref.tick();
	}
}