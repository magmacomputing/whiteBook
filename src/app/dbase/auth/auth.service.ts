import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { Store, Select } from '@ngxs/store';
import { SLICE } from '@dbase/state/store.define';

import { AuthModule } from '@dbase/auth/auth.module';
import { getAuthProvider, isActive } from '@dbase/auth/auth.library';
import { LoginSocial, Logout, CheckSession, IAuthState, LoginEmail } from '@dbase/state/auth.define';

import { FIELD } from '@dbase/data/data.define';
import { IProvider } from '@dbase/data/data.schema';
import { TScopes, TParams } from '@dbase/auth/auth.interface';

import { IObject } from '@lib/object.library';
import { asArray } from '@lib/array.library';
import { dbg } from '@lib/logger.library';

@Injectable({ providedIn: AuthModule })
export class AuthService {
  @Select() auth$!: Observable<IAuthState>;

  private dbg: Function = dbg.bind(this);

  constructor(private readonly store: Store) { this.dbg('new'); }

  get isAuth() {
    return this.auth$.pipe(
      map(auth => isActive(auth))
    )
  }

  public state() {
    return this.store
      .selectSnapshot<IAuthState>(state => state[SLICE.auth]);
  }

  public signOut() {
    this.store.dispatch(new Logout());
  }

  public check() {
    this.store.dispatch(new CheckSession());
  }

  public async signIn(provider: IProvider, opts: IObject<any> = {}) {
    this.dbg('signIn: %j', provider);

    switch (provider.type) {
      case undefined:
      case 'social':
        this.signInSocial(provider);
        break;

      case 'oauth':
        this.signInOAuth(provider);
        break;

      case 'email':
        this.signInEmail(provider, opts.email, opts.password);
        break;

      case 'play':
        this.signInPlay(provider);
        break;

      case 'phone':
        this.signInPhone(provider);
        break;

      case 'anonymous':
        this.signInAnon(provider);
        break;

      default:
        this.dbg('signIn: %s', provider);
        break;
    }
  }

  /** prepare the AuthProvider object before dispatching the SignIn flow */
  private signInSocial(provider: IProvider) {
    const [, authProvider] = getAuthProvider(provider[FIELD.key]);
    if (!authProvider) return;                      // misconfigured providerId

    asArray(provider.scope)
      .forEach(scope => (authProvider as TScopes).addScope(scope));

    if (provider.params)
      (authProvider as TParams).setCustomParameters(provider.params);

    this.store.dispatch(new LoginSocial(authProvider));
  }

  private signInEmail(provider: IProvider, email: string, password: string) {
    this.store.dispatch(new LoginEmail(email, password));
  }

  private signInOAuth(provider: IProvider) { }
  private signInPlay(provider: IProvider) { }
  private signInPhone(provider: IProvider) { }
  private signInAnon(provider: IProvider) { }
}
