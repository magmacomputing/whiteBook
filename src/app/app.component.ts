import { Component } from '@angular/core';
import { Store } from '@ngxs/store';
import { Router } from '@angular/router';
// import { Navigate } from '@ngxs/router-plugin';

import { DataService } from '@dbase/data/data.service';
import { AuthService } from '@dbase/auth/auth.service';

@Component({
	selector: 'wb-root',
	templateUrl: './app.component.html',
})
export class AppComponent {

	constructor(readonly data: DataService, readonly auth: AuthService, private readonly store: Store, private router: Router) { }

	navigate(url: string) {
		this.router.navigateByUrl(url);
		// this.store.dispatch(new Navigate([url]));
	}
}
