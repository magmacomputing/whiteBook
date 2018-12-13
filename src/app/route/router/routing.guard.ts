import { Injectable } from '@angular/core';
import { CanActivate, CanDeactivate, Router } from '@angular/router';

import { ROUTE } from '@route/route.define';
import { NavigateService } from '@route/navigate.service';

import { AuthModule } from '@service/auth/auth.module';
import { AuthService } from '@service/auth/auth.service';
import { StateService } from '@dbase/state/state.service';

import { isUndefined } from '@lib/type.library';
import { getPath } from '@lib/object.library';
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
	private member$ = this.state.getMemberData();

	constructor(private state: StateService, private navigate: NavigateService) { this.dbg('new') }

	async canActivate() {
		const state = await this.state.asPromise(this.member$);
		const planClaim = getPath<string>(state.auth, 'token.claims.claims.plan');
		const planProfile = getPath(state.member, 'plan[0].plan');

		if (!isUndefined(planClaim) || !isUndefined(planProfile))
			return true;      												// ok to access Route

		this.navigate.route(ROUTE.plan);
		return false;
	}
}

/** check if we are returning from an OAuth provider */
@Injectable({ providedIn: AuthModule })
export class OAuthGuard implements CanActivate {
	private dbg = dbg(this);

	constructor(private router: Router) { this.dbg('new') }

	canActivate() {
		return true;
}

	canDeactivate() {
		const url = this.router.url.split('?')[0];

		return url !== ROUTE.oauth;
	}
}