import { Component } from '@angular/core';
import { Router } from '@angular/router';
// import { Navigate } from '@ngxs/router-plugin';

import { DataService } from '@dbase/data/data.service';
import { AuthService } from '@dbase/auth/auth.service';

@Component({
	selector: 'wb-root',
	templateUrl: './app.component.html',
})
export class AppComponent {

	constructor(readonly data: DataService, readonly auth: AuthService, private router: Router) { }

}
