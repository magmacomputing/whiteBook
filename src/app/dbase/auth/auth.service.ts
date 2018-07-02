import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import * as firebase from 'firebase/app';
import { AuthProvider } from '@firebase/auth-types';

import { Store, Select } from '@ngxs/store';
import { TruncMember, TruncAttend } from '@dbase/state/store.define';
import { AuthModule } from '@dbase/auth/auth.module';
import { AuthState } from '@dbase/state/auth.state';
import { LoginSocial, Logout, CheckSession, IAuthState } from '@dbase/state/auth.define';

import { IProvider } from '@dbase/data/data.interface';
import { TScopes, TParams, JWT } from '@dbase/auth/auth.interface';

import { asArray, isNull } from '@lib/object.library';
import { getStamp } from '@lib/date.library';
import { dbg } from '@lib/logger.library';

@Injectable({ providedIn: AuthModule })
export class AuthService {
  @Select(AuthState.getUser) auth$!: Observable<IAuthState>;

  private dbg: Function = dbg.bind(this);

  constructor(private readonly store: Store) { this.dbg('new'); }

  get active() {
    return this.auth$.pipe(
      map(auth => {
        switch (true) {
          case isNull(auth.userInfo):
          case isNull(auth.userToken):
          case !isNull(auth.userToken) && auth.userToken[JWT.expires] < getStamp():
            return false;           // not logged-in

          default:
            return true;            // is logged-in
        }
      })
    )
  }

  public signOut() {
    this.store.dispatch(new Logout());
    this.store.dispatch(new TruncMember());
    this.store.dispatch(new TruncAttend());
  }

  public check() {
    this.store.dispatch(new CheckSession());
  }

  public user() {
    return new Promise<IAuthState>(resolve =>
      this.auth$.subscribe(user => resolve(user))
    )
  }

  public async signIn(config: IProvider) {
    switch (config.type) {
      case undefined:
      case 'social':
        this.signInSocial(config);
        break;

      case 'oauth':
        this.signInOAuth(config);
        break;

      case 'email':
        this.signInEmail(config);
        break;

      case 'play':
        this.signInPlay(config);
        break;

      case 'phone':
        this.signInPhone(config);
        break;

      case 'anonymous':
        this.signInAnon(config);
        break;

      default:
        this.dbg('signIn: %s', config);
        break;
    }
  }

  /** prepare the AuthProvider object before dispatching the SignIn flow */
  private signInSocial(config: IProvider) {
    const authProvider = this.authProvider(config.name);

    asArray(config.scope)
      .forEach(scope => (authProvider as TScopes).addScope(scope));

    if (config.params)
      (authProvider as TParams).setCustomParameters(config.params);

    this.store.dispatch(new LoginSocial(authProvider));
  }

  private signInOAuth(config: IProvider) { }
  private signInEmail(config: IProvider) { }
  private signInPlay(config: IProvider) { }
  private signInPhone(config: IProvider) { }
  private signInAnon(config: IProvider) { }

  private authProvider(providerId: string) {
    let authProvider: AuthProvider;

    switch (providerId) {
      case 'google':
      case 'google.com':
        authProvider = new firebase.auth.GoogleAuthProvider();
        break;

      case 'twitter':
      case 'twitter.com':
        authProvider = new firebase.auth.TwitterAuthProvider();
        break;

      case 'github':
      case 'github.com':
        authProvider = new firebase.auth.GithubAuthProvider();
        break;

      case 'facebook':
      case 'facebook.com':
      default:
        authProvider = new firebase.auth.FacebookAuthProvider();
        break;
    }

    return authProvider;
  }
}
