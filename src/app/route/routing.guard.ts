import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';

import { Store } from '@ngxs/store';
import { IAuthState } from '@dbase/state/auth.define';
import { AuthState } from '@dbase/state/auth.state';
import { MemberState } from '@dbase/state/member.state';

import { asAt } from '@dbase/app/app.library';
import { STORE, FIELD } from '@dbase/data/data.define';
import { IProfilePlan } from '@dbase/data/data.schema';
import { TWhere } from '@dbase/fire/fire.interface';
import { AuthModule } from '@dbase/auth/auth.module';
import { AuthService } from '@dbase/auth/auth.service';

import { ROUTE } from '@route/route.define';
import { isArray } from '@lib/type.library';
import { dbg } from '@lib/logger.library';

@Injectable({ providedIn: AuthModule })
export class AuthGuard implements CanActivate {
	private dbg: Function = dbg.bind(this);

	constructor(private auth: AuthService, private router: Router) { this.dbg('new') }

	async canActivate() {
		const state = await this.auth.user;

		if (state.auth.user)
			return true;

		this.router.navigateByUrl(ROUTE.login);
		return false;
	}
}

/** ensure Member Profile has a current 'plan' */
@Injectable({ providedIn: AuthModule })
export class ProfileGuard implements CanActivate {
	private dbg: Function = dbg.bind(this);

	constructor(private store: Store, private router: Router) { this.dbg('new') }

	canActivate(next: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
		const member = this.store.selectSnapshot(MemberState)
		const where: TWhere = { fieldPath: FIELD.type, value: 'plan' };
		const plan = asAt<IProfilePlan>(member[STORE.profile], where);

		if (isArray(plan) && plan.length)
			return true;      												// ok to access Route

		this.router.navigateByUrl(ROUTE.plan);
		return false;
	}
}