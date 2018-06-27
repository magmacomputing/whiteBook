import { ApplicationRef } from '@angular/core';
import { User } from '@firebase/auth-types';
import { AngularFireAuth } from 'angularfire2/auth';

import { take, tap } from 'rxjs/operators';
import { State, Selector, StateContext, Action, NgxsOnInit } from '@ngxs/store';
import { Navigate } from '@ngxs/router-plugin';
import { SLICE } from '@dbase/state/store.define';

import { IAuthState, CheckSession, LoginSuccess, LoginRedirect, LoginFailed, LogoutSuccess, LoginSocial, Logout, LoginToken } from '@dbase/auth/auth.define';
import { SyncService } from '@dbase/sync/sync.service';
import { TTokenClaims } from '@dbase/auth/auth.interface';
import { COLLECTION, FIELD } from '@dbase/data/data.define';
import { IQuery } from '@dbase/fire/fire.interface';

import { decodeBase64 } from '@lib/crypto.library';
import { cloneObj } from '@lib/object.library';
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

	constructor(private afAuth: AngularFireAuth,/** private sync: SyncService, */private ref: ApplicationRef) { }

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
	@Action(LoginSuccess)														// on each LoginSuccess, navigate to AttendComponent
	onLoginSuccess(ctx: StateContext<IAuthState>) {
		this.dbg('navigate: /attend');
		ctx.dispatch(new Navigate(['/attend']));
		this.ref.tick();
	}

	@Action(LoginSuccess)														// on each LoginSuccess, fetch latest UserInfo, IdToken
	setUserStateOnSuccess(ctx: StateContext<IAuthState>, { user }: LoginSuccess) {
		const currUser: any = cloneObj(this.afAuth.auth.currentUser);
		const accessToken = currUser.stsTokenManager.accessToken;	// TODO: rationalize this internal reference
		const token = decodeBase64<TTokenClaims>(accessToken.split('.')[1]);

		this.dbg('claims: %j', token);
		ctx.patchState({ userInfo: user, userToken: token });
	}

	@Action(LoginSuccess)														// on each LoginSuccess, fetch /member collection
	onMember(ctx: StateContext<IAuthState>, { user }: LoginSuccess) {
		const query: IQuery = { where: { fieldPath: FIELD.uid, opStr: '==', value: user.uid } };

		// this.sync.on(COLLECTION.Member, SLICE.member, query);
		// this.sync.on(COLLECTION.Attend, SLICE.attend, query);
	}

	@Action(LoginToken)															// fetch latest IdToken
	setToken(ctx: StateContext<IAuthState>) {
		return (this.afAuth.auth.currentUser as User).getIdToken()
			.then(token => decodeBase64<TTokenClaims>(token.split('.')[1]))
			.then(token => ctx.patchState({ userToken: token }))
			.then(_ => this.dbg('token: %j', ctx.getState().userToken))
	}

	@Action(LoginRedirect)
	onLoginRedirect(ctx: StateContext<IAuthState>) {
		this.dbg('onLoginRedirect, navigating to /login');
		ctx.dispatch(new Navigate(['/login']));
		this.ref.tick();
	}

	@Action([LoginFailed, LogoutSuccess])
	setUserStateOnFailure(ctx: StateContext<IAuthState>) {
		// this.sync.off(COLLECTION.Member);
		// this.sync.off(COLLECTION.Attend);

		ctx.setState({ userInfo: null, userToken: null });
		ctx.dispatch(new LoginRedirect());
		this.ref.tick();
	}
}