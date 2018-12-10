import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';

import { Store } from '@ngxs/store';
import { MemberState } from '@dbase/state/member.state';
import { ROUTE } from '@route/route.define';
import { NavigateService } from '@route/navigate.service';

import { asAt } from '@dbase/app/app.library';
import { STORE, FIELD } from '@dbase/data/data.define';
import { IProfilePlan } from '@dbase/data/data.schema';
import { TWhere } from '@dbase/fire/fire.interface';
import { AuthModule } from '@service/auth/auth.module';
import { AuthService } from '@service/auth/auth.service';

import { isArray } from '@lib/type.library';
import { dbg } from '@lib/logger.library';

@Injectable({ providedIn: AuthModule })
export class AuthGuard implements CanActivate {
	private dbg = dbg(this);

	constructor(private auth: AuthService, private router: Router, private navigate: NavigateService) { this.dbg('new') }

	async canActivate() {
		const state = await this.auth.user;

		if (state.auth.user)
			return true;

		this.navigate.route(ROUTE.login);
		return false;
	}
}

/** ensure Member Profile has a current 'plan' */
@Injectable({ providedIn: AuthModule })
export class ProfileGuard implements CanActivate {
	private dbg = dbg(this);

	constructor(private store: Store, private router: Router, private navigate: NavigateService) { this.dbg('new') }

	async canActivate() {
		const member = this.store.selectSnapshot(MemberState)
		const where: TWhere = { fieldPath: FIELD.type, value: 'plan' };
		const plan = asAt<IProfilePlan>(member[STORE.profile], where);

		if (isArray(plan) && plan.length)
			return true;      												// ok to access Route

		this.navigate.route(ROUTE.plan);
		return false;
	}
}