import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';

import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Select, Store } from '@ngxs/store';
import { Navigate } from '@ngxs/router-plugin';
import { MemberState } from '@state/member.state';

import { IProfilePlan } from '@dbase/data/data.interface';
import { AuthModule } from '@dbase/auth/auth.module';
import { JWT } from '@dbase/auth/auth.interface';
import { LoginRedirect, IAuthState } from '@dbase/auth/auth.define';

import { isNull, isArray } from '@lib/object.library';
import { getStamp } from '@lib/date.library';
import { dbg } from '@lib/logger.library';

@Injectable({ providedIn: AuthModule })
export class AuthGuard implements CanActivate {
  @Select() auth$!: Observable<IAuthState>;         // current Authentication object
  private dbg: Function = dbg.bind(this);

  constructor(private store: Store) { this.dbg('new') }

  canActivate(next: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean> {
    return this.auth$.pipe(
      map(auth => {
        switch (true) {
          case isNull(auth.userInfo):
          case isNull(auth.userToken):
          case !isNull(auth.userToken) && auth.userToken[JWT.expires] < getStamp():
            this.store.dispatch(new LoginRedirect());
            return false;

          default:
            return true;                           // ok to access Route
        }
      })
    )
  }
}

/** ensure Member Profile has a current 'plan' */
@Injectable({ providedIn: AuthModule })
export class ProfileGuard implements CanActivate {
  @Select(MemberState.plan) plan$!: Observable<IProfilePlan[]>;
  private dbg: Function = dbg.bind(this);

  constructor(private store: Store) { this.dbg('new') }

  canActivate(next: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    return this.plan$.pipe(
      map(plan => {
        this.dbg('plan: %j', plan);
        if (isArray(plan) && plan.length) return true;// ok to access Route

        this.store.dispatch(new Navigate(['/profile/plan']));
        return false;
      })
    )
  }
}