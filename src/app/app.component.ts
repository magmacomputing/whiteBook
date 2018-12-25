import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

import { DataService } from '@dbase/data/data.service';
import { AuthService } from '@service/auth/auth.service';
import { StateService } from '@dbase/state/state.service';

@Component({
	selector: 'wb-root',
	templateUrl: './app.component.html',
})
export class AppComponent implements OnInit {
	public data$ = this.state.getMemberData();

	constructor(readonly data: DataService, readonly auth: AuthService, readonly state: StateService, private router: Router) { }

	ngOnInit() { }

}
