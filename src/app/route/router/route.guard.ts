import { Injectable } from '@angular/core';
import { CanActivate, CanDeactivate } from '@angular/router';
import { Observable } from 'rxjs';

import { ROUTE } from '@route/router/route.define';
import { NavigateService } from '@route/router/navigate.service';
import { LoginModule } from '@route/login/login.module';

import { fire } from '@dbase/fire/fire.library';
import { AuthModule } from '@service/auth/auth.module';
import { DataService } from '@dbase/data/data.service';
import { FIELD, PROFILE, STORE } from '@dbase/data.define';

import { getPath } from '@library/object.library';
import { dbg } from '@library/logger.library';

/**
 * TODO: The ROUTE.oauth should not be accessible by the Member.
 * It is provided solely so that an OAuth provider has a redirect back to the App
 * (after the Member authenticates).  
 */
@Injectable({ providedIn: AuthModule })
export class OAuthGuard implements CanActivate {
	#dbg = dbg(this);

	constructor(private navigate: NavigateService) { this.#dbg('new') }

	async canActivate() {
		this.#dbg('oauth: %s', this.navigate.url);
		return true;
	}
}

/** ensure Member Profile has a current 'plan' */
@Injectable({ providedIn: AuthModule })
export class ProfileGuard implements CanActivate {
	#dbg = dbg(this);

	constructor(private navigate: NavigateService, private data: DataService) { this.#dbg('new') }

	async canActivate() {
		const profile = await this.data.getProfileUser();

		if (profile[PROFILE.Plan])
			return true;

		this.navigate.route(ROUTE.Plan);						// redirect to PlanComponent
		return false;
	}
}

/** check if Component allows navigation away */
interface DeactivateComponent {
	canDeactivate: () => Observable<boolean> | Promise<boolean> | boolean;
}
@Injectable({ providedIn: LoginModule })
export class DeactivateGuard implements CanDeactivate<DeactivateComponent> {
	#dbg = dbg(this);

	constructor() { this.#dbg('new') }

	canDeactivate(component: DeactivateComponent) {
		return component.canDeactivate ? component.canDeactivate() : true;
	}
}