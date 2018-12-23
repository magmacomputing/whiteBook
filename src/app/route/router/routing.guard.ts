import { Injectable } from '@angular/core';
import { CanActivate, CanDeactivate } from '@angular/router';
import { Observable } from 'rxjs';

import { ROUTE } from '@route/route.define';
import { NavigateService } from '@route/navigate.service';

import { AuthModule } from '@service/auth/auth.module';
import { AuthService } from '@service/auth/auth.service';
import { StateService } from '@dbase/state/state.service';
import { LoginModule } from '@route/login/login.module';
import { IProfilePlan } from '@dbase/data/data.schema';

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
	// private member$ = this.state.getMemberData();

	constructor(private state: StateService, private navigate: NavigateService) { this.dbg('new') }

	async canActivate() {
		const user = await this.state.asPromise(this.state.getAuthData());
		// this.dbg('auth: %j', user);
		const state = await this.state.asPromise(this.state.getMemberData());
		const planClaim = getPath<string>(state.auth, 'token.claims.claims.plan');
		const planProfile = getPath<IProfilePlan>(state.member, 'plan[0].plan');

		this.dbg('planClaim: %j', planClaim);
		this.dbg('planProfile: %j', planProfile);
		this.dbg('state: %j', state.member['profile']);
		this.dbg('claims: %j', state.auth.token!.claims.claims);

		if (!isUndefined(planClaim) || !isUndefined(planProfile))
			return true;      												// ok to access Route

		this.navigate.route(ROUTE.plan);
		return false;
	}
}

/** check if Component allows navigation away */
interface IDeactivateComponent {
	canDeactivate: () => Observable<boolean> | Promise<boolean> | boolean;
}
@Injectable({ providedIn: LoginModule })
export class DeactivateGuard implements CanDeactivate<IDeactivateComponent> {
	private dbg = dbg(this);

	constructor() { this.dbg('new') }

	canDeactivate(component: IDeactivateComponent) {
		return component.canDeactivate ? component.canDeactivate() : true;
	}
}