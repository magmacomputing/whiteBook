import { Injectable } from '@angular/core';
import { CanActivate, CanDeactivate } from '@angular/router';
import { Observable } from 'rxjs';

import { ROUTE } from '@route/route.define';
import { NavigateService } from '@route/navigate.service';
import { LoginModule } from '@route/login/login.module';

import { AuthModule } from '@service/auth/auth.module';
import { addWhere } from '@dbase/fire/fire.library';
import { LState } from '@dbase/state/state.define';
import { StoreStorage } from '@dbase/sync/sync.define';
import { FIELD } from '@dbase/data/data.define';
import { IProfilePlan } from '@dbase/data/data.schema';
import { asAt } from '@library/app.library';

import { getLocalStore } from '@lib/window.library';
import { getPath } from '@lib/object.library';
import { dbg } from '@lib/logger.library';

/**
 * TODO: The ROUTE.oauth should not be accessible by the Member.
 * It is provided solely so that an OAuth provider has a redirect back to the App
 * (after the Member authenticates).  
 */
@Injectable({ providedIn: AuthModule })
export class OAuthGuard implements CanActivate {
	private dbg = dbg(this);

	constructor(private navigate: NavigateService) { this.dbg('new') }

	async canActivate() {
		this.dbg('oauth: %s', this.navigate.url);
		return true;
	}
}

/** ensure Member Profile has a current 'plan' */
@Injectable({ providedIn: AuthModule })
export class ProfileGuard implements CanActivate {
	private dbg = dbg(this);

	constructor(private navigate: NavigateService) { this.dbg('new') }

	async canActivate() {
		const localState = getLocalStore<LState>(StoreStorage) || {};
		const profile = getPath<IProfilePlan[]>(localState, 'member.profile') || [];
		const planProfile = asAt(profile, addWhere(FIELD.type, 'plan'))[0];
		if (getPath<string>(planProfile, 'plan'))
			return true;															// found a current 'plan' in localStorage

		// const state = await this.auth.user;
		// const planClaim = getPath<string>(state.auth, 'token.claims.claims.plan');
		// if (!isUndefined(planClaim))
		// 	return true;															// found a 'plan' on customClaims token

		this.navigate.route(ROUTE.plan);						// redirect to PlanComponent
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