import { Injectable } from '@angular/core';
import * as firebase from 'firebase/app';
import { AuthProvider } from '@firebase/auth-types';

import { AuthModule } from '@dbase/auth/auth.module';
import { Store } from '@ngxs/store';

import { IProvider } from '@func/app/app.interface';
import { LoginSocial, Logout } from '@dbase/auth/auth.define';
import { TScopes, TParams } from '@dbase/auth/auth.interface';

import { isArray } from '@lib/object.library';
import { dbg } from '@lib/logger.library';

@Injectable({ providedIn: AuthModule })
export class AuthService {
  private dbg: Function = dbg.bind(this);

  constructor(private readonly store: Store) {
    this.dbg('new');
  }

  public signOut() {
    this.store.dispatch(new Logout());
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

    if (config.scope) {
      const scopes = isArray(config.scope) ? config.scope : [config.scope];
      scopes.forEach(scope => (authProvider as TScopes).addScope(scope));
    }

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
