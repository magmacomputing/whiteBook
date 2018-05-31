import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';

import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Select, Store } from '@ngxs/store';

import { AuthModule } from '@dbase/auth/auth.module';
import { JWT } from '@dbase/auth/auth.interface';
import { LoginRedirect, IAuthState } from '@dbase/auth/auth.define';
import { isNull, isUndefined } from '@lib/object.library';
import { getStamp } from '@lib/date.library';
import { dbg } from '@lib/logger.library';

@Injectable({ providedIn: AuthModule })
export class AuthGuard implements CanActivate {
  private dbg: Function = dbg.bind(this);
  @Select() auth$!: Observable<IAuthState>;         // current Authentication object

  constructor(private store: Store) { }

  canActivate(next: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean> {
    return this.auth$.pipe(
      map(auth => {
        this.dbg('auth: %j', auth);
        if (isNull(auth) || isUndefined(auth))
          this.store.dispatch(new LoginRedirect()); // not logged-in
        // return false;

        if (auth && auth.userToken && auth.userToken.expirationTime < getStamp())
          this.store.dispatch(new LoginRedirect()); // authentication expired
        // return false;

        return true;                                // ok to access Route
      })
    );
  }
}