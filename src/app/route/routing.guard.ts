import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';

import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Select, Store } from '@ngxs/store';
import { Navigate } from '@ngxs/router-plugin';

import { getStore } from '@dbase/state/store.state';
import { ISelector } from '@dbase/state/store.define';
import { MemberState } from '@dbase/state/member.state';
import { IAuthState } from '@dbase/state/auth.define';

import { STORE, FIELD } from '@dbase/data/data.define';
import { IWhere } from '@dbase/fire/fire.interface';
import { isActive } from '@dbase/auth/auth.library';
import { AuthModule } from '@dbase/auth/auth.module';

import { ROUTE } from '@route/route.define';
import { isArray } from '@lib/object.library';
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
    const where: IWhere = { fieldPath: FIELD.type, opStr: '==', value: 'plan' };
    return getStore(this.member$, STORE.profile, where).pipe(
      map(plan => {
        if (isArray(plan) && plan.length) return true;// ok to access Route

        this.store.dispatch(new Navigate([ROUTE.plan]));
        return false;
      })
    )
  }
}