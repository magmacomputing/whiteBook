import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';

import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Select, Store } from '@ngxs/store';
import { Navigate } from '@ngxs/router-plugin';
import { getStore } from '@dbase/state/store.state';
import { ISelector } from '@dbase/state/store.define';
import { MemberState } from '@dbase/state/member.state';

import { STORE } from '@dbase/data/data.define';
import { isActive } from '@dbase/auth/auth.library';
import { AuthModule } from '@dbase/auth/auth.module';
import { JWT } from '@dbase/auth/auth.interface';
import { LoginRedirect, IAuthState } from '@dbase/state/auth.define';

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
      map(auth => isActive(auth))
    )
  }
}

/** ensure Member Profile has a current 'plan' */
@Injectable({ providedIn: AuthModule })
export class ProfileGuard implements CanActivate {
  @Select(MemberState.getMember) member$!: Observable<ISelector>;
  private dbg: Function = dbg.bind(this);

  constructor(private store: Store) { this.dbg('new') }

  canActivate(next: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    return getStore(this.member$, STORE.profile, { fieldPath: 'type', opStr: '==', value: 'plan' }).pipe(
      map(plan => {
        const segment = `/${STORE.profile}/plan`;
        this.dbg('plan: %j', plan);
        if (isArray(plan) && plan.length) return true;// ok to access Route

        this.store.dispatch(new Navigate([segment]));
        return false;
      })
    )
  }
}