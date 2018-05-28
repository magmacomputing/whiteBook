import { ApplicationRef } from '@angular/core';
import { AngularFireAuth } from 'angularfire2/auth';
import { User, UserInfo } from '@firebase/auth-types';

import { take, tap } from 'rxjs/operators';
import { State, Selector, StateContext, Action, Store } from '@ngxs/store';
import { Navigate } from '@ngxs/router-plugin';
import { SLICE } from '@app/state/state.define';
import { IAuthState, CheckSession, LoginSuccess, LoginRedirect, LoginFailed, LogoutSuccess } from '@state/auth.define';

import { dbg } from '@lib/logger.library';

@State<IAuthState>({
	name: SLICE.auth,
	defaults: {
		userInfo: null,
		userToken: null,
	}
})
export class AuthState {
	private dbg: Function = dbg.bind(this);

	constructor(private store: Store, private afAuth: AngularFireAuth, private ref: ApplicationRef) { }
	ngxsOnInit(sc: StateContext<IAuthState>) {
		sc.dispatch(new CheckSession());								/** Dispatch CheckSession on start */
	}

	/** Selectors */
	@Selector()
	static getUser(state: IAuthState) {
		return state;
	}

	/** Commands */
	@Action(CheckSession)
	checkSession(sc: StateContext<IAuthState>) {
		return this.afAuth.authState.pipe(
			take(1),
			tap((user: User | null) => {
				this.dbg('checkSession: ', user ? `${user.displayName} is logged in` : 'no user found');
				if (user)
					sc.dispatch(new LoginSuccess(user))
				else sc.dispatch(new Navigate(['/login']));
			})
		);
	}

	/** Events */
  @Action(LoginSuccess)
  onLoginSuccess(sc: StateContext<IAuthState>) {
    this.dbg('onLoginSuccess, navigating to /attend');
    sc.dispatch(new Navigate(['/attend']));
    this.ref.tick();
  }

  @Action(LoginSuccess)
  setUserStateOnSuccess(sc: StateContext<IAuthState>, event: LoginSuccess) {
    this.dbg('setUserStateOnSuccess');
    sc.setState({ userInfo: event.user, userToken: null });
  }


  @Action(LoginRedirect)
  onLoginRedirect(sc: StateContext<AuthState>) {
    this.dbg('onLoginRedirect, navigating to /login');
		sc.dispatch(new Navigate(['/login']));
		this.ref.tick();
  }

  @Action([LoginFailed, LogoutSuccess])
  setUserStateOnFailure(sc: StateContext<IAuthState>) {
    sc.setState({ userInfo: null, userToken: null });
		sc.dispatch(new LoginRedirect());
		this.ref.tick();
  }
}