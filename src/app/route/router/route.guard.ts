import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, CanDeactivate, RouterStateSnapshot } from '@angular/router';
import { Observable } from 'rxjs';

import { ROUTE } from '@route/router/route.define';
import { NavigateService } from '@route/router/navigate.service';
import { LoginModule } from '@route/login/login.module';

import { AuthModule } from '@service/auth/auth.module';
import { DataService } from '@dbase/data/data.service';
import { PROFILE } from '@dbase/data.define';

import { isDefined } from '@library/type.library';
import { dbg } from '@library/logger.library';
import { take } from 'rxjs/operators';

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

@Injectable({ providedIn: AuthModule })
export class LoginGuard implements CanActivate {
	#dbg = dbg(this, 'LoginGuard');

	constructor(private data: DataService) { this.#dbg('new') }

	async canActivate(route: ActivatedRouteSnapshot) {
		const currUser = await this.data.getCurrentUser();

		return isDefined(currUser);
	}
}

@Injectable({ providedIn: AuthModule })
export class AdminGuard implements CanActivate {
	#dbg = dbg(this, 'AdminGuard');

	constructor(private data: DataService) { this.#dbg('new') }

	async canActivate(route: ActivatedRouteSnapshot) {
		const isAdmin = await this.data.isAdmin$().pipe(take(1)).toPromise();
		return isAdmin;
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