import { Injectable } from '@angular/core';
import { CanActivate, CanDeactivate } from '@angular/router';
import { Observable } from 'rxjs';

import { ROUTE } from '@route/router/route.define';
import { NavigateService } from '@route/router/navigate.service';
import { LoginModule } from '@route/login/login.module';

import { AuthModule } from '@service/auth/auth.module';
import { addWhere } from '@dbase/fire/fire.library';
import { LState } from '@dbase/state/state.define';
import { Sync } from '@dbase/sync/sync.define';
import { FIELD, STORE } from '@dbase/data/data.define';
import { IProfilePlan } from '@dbase/data/data.schema';
import { asAt } from '@library/app.library';

import { Storage } from '@library/browser.library';
import { getPath } from '@library/object.library';
import { dbg } from '@library/logger.library';

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
		const localState = new Storage('local').get<LState>(Sync.storeStorage, {});
		const profile = getPath<IProfilePlan[]>(localState, 'member.profile') || [];
		const planProfile = asAt(profile, addWhere(FIELD.type, STORE.plan));
		if (getPath<string>(planProfile[0], STORE.plan))
			return true;															// found a current 'plan' in localStorage

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