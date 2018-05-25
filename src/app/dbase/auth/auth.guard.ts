// import { Injectable } from '@angular/core';
// import { Router, CanActivate } from '@angular/router';
// import { RoutingModule } from '@route/routing.module';

// import { Observable } from 'rxjs';
// import { Store } from '@ngxs/store';
// import { IAuthState, AuthState } from '@svc/state/auth.state';
// import { StateService } from '@svc/state/state.service';
// import { TTokenClaims, JWT } from './auth.interface';

// import { getStamp } from '@lib/date.library';
// import { dbg } from '@lib/log.library';
// import { isUndefined } from '@app/library/object.library';

// @Injectable()
// export class AuthGuard implements CanActivate {
// 	private dbg: Function = dbg.bind(this);

// 	constructor(private router: Router, private state: StateService) { }

// 	canActivate() {
// 		const claims = this.state.selectSnapshot<TTokenClaims>((state: any) => state.auth && state.auth.claims);

// 		if (claims && claims[JWT.expires] > getStamp()) {				// is expiration later than now()
// 			return true;
// 		}

// 		this.router.navigate(['/login']);
// 		return false;
// 	}
// }