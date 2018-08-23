import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';

import { Store } from '@ngxs/store';
import { Navigate } from '@ngxs/router-plugin';
import { IAuthState } from '@dbase/state/auth.define';
import { AuthState } from '@dbase/state/auth.state';
import { MemberState } from '@dbase/state/member.state';

import { asAt } from '@dbase/app/app.library';
import { STORE, FIELD } from '@dbase/data/data.define';
import { IProfilePlan } from '@dbase/data/data.schema';
import { IWhere } from '@dbase/fire/fire.interface';
import { AuthModule } from '@dbase/auth/auth.module';

import { ROUTE } from '@route/route.define';
import { isArray, isUndefined } from '@lib/type.library';
import { dbg } from '@lib/logger.library';

@Injectable({ providedIn: AuthModule })
export class AuthGuard implements CanActivate {
  private dbg: Function = dbg.bind(this);

  constructor(private store: Store) { this.dbg('new') }

  canActivate(next: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    const auth = this.store.selectSnapshot<IAuthState>(AuthState.auth);

    return !isUndefined(auth.userToken);
  }
}

/** ensure Member Profile has a current 'plan' */
@Injectable({ providedIn: AuthModule })
export class ProfileGuard implements CanActivate {
  private dbg: Function = dbg.bind(this);

  constructor(private store: Store) { this.dbg('new') }

  canActivate(next: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    const member = this.store.selectSnapshot(MemberState)
    const where: IWhere = { fieldPath: FIELD.type, value: 'plan' };
    const plan = asAt<IProfilePlan>(member[STORE.profile], where);

    if (isArray(plan) && plan.length) return true;      // ok to access Route

    this.store.dispatch(new Navigate([ROUTE.plan]));
    return false;
  }
}