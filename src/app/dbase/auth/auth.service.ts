import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { Store, Select } from '@ngxs/store';
import { TruncMember, TruncAttend } from '@dbase/state/store.define';
import { AuthModule } from '@dbase/auth/auth.module';
import { AuthState } from '@dbase/state/auth.state';
import { getAuthProvider, isActive } from '@dbase/auth/auth.library';
import { LoginSocial, Logout, CheckSession, IAuthState, LoginEmail } from '@dbase/state/auth.define';

import { FIELD } from '@dbase/data/data.define';
import { IProvider } from '@dbase/data/data.interface';
import { TScopes, TParams, JWT } from '@dbase/auth/auth.interface';

import { asArray, isNull, IObject } from '@lib/object.library';
import { getStamp } from '@lib/date.library';
import { dbg } from '@lib/logger.library';

@Injectable({ providedIn: AuthModule })
export class AuthService {
  @Select(AuthState.getUser) auth$!: Observable<IAuthState>;

  private dbg: Function = dbg.bind(this);

  constructor(private readonly store: Store) { this.dbg('new'); }

  get active() {
    return this.auth$.pipe(
      map(auth => isActive(auth))
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

  public async signIn(config: IProvider, opts: IObject<any> = {}) {
    this.dbg('signIn: %j', config);

    switch (config.type) {
      case undefined:
      case 'social':
        this.signInSocial(config);
        break;

      case 'oauth':
        this.signInOAuth(config);
        break;

      case 'email':
        this.signInEmail(config, opts.email, opts.password);
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
    const [authProvider, type] = getAuthProvider(config[FIELD.key]);

    asArray(config.scope)
      .forEach(scope => (authProvider as TScopes).addScope(scope));

    if (config.params)
      (authProvider as TParams).setCustomParameters(config.params);

    this.store.dispatch(new LoginSocial(authProvider));
  }

  private signInEmail(config: IProvider, email: string, password: string) {
    this.store.dispatch(new LoginEmail(email, password));
  }

  private signInOAuth(config: IProvider) { }
  private signInPlay(config: IProvider) { }
  private signInPhone(config: IProvider) { }
  private signInAnon(config: IProvider) { }
}
