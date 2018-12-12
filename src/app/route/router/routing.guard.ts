import { Injectable } from '@angular/core';
import { CanActivate } from '@angular/router';

import { ROUTE } from '@route/route.define';
import { NavigateService } from '@route/navigate.service';

import { STORE, FIELD } from '@dbase/data/data.define';
import { IProfilePlan } from '@dbase/data/data.schema';
import { TWhere } from '@dbase/fire/fire.interface';
import { AuthModule } from '@service/auth/auth.module';
import { AuthService } from '@service/auth/auth.service';
import { StateService } from '@dbase/state/state.service';

import { isUndefined } from '@lib/type.library';
import { dbg } from '@lib/logger.library';

@Injectable({ providedIn: AuthModule })
export class AuthGuard implements CanActivate {
	private dbg = dbg(this);

	constructor(private auth: AuthService, private navigate: NavigateService) { this.dbg('new') }

	async canActivate() {
		const state = await this.auth.user;

		if (state.auth.user)												// is logged-on
			return true;

		this.navigate.route(ROUTE.login);
		return false;
	}
}

/** ensure Member Profile has a current 'plan' */
@Injectable({ providedIn: AuthModule })
export class ProfileGuard implements CanActivate {
	private dbg = dbg(this);

	constructor(private state: StateService, private navigate: NavigateService) { this.dbg('new') }

	async canActivate() {
		const where: TWhere = { fieldPath: FIELD.type, value: 'plan' };
		const plan = await this.state.getSingle<IProfilePlan>(STORE.profile, where);

		if (!isUndefined(plan))
			return true;      												// ok to access Route

		this.navigate.route(ROUTE.plan);
		return false;
	}
}