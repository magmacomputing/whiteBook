import { Component, OnInit } from '@angular/core';

import { STORE } from '@dbase/data/data.define';
import { IProvider } from '@dbase/data/data.schema';
import { AuthService } from '@dbase/auth/auth.service';
import { StateService } from '@dbase/state/state.service';

@Component({
	selector: 'wb-login',
	templateUrl: './login.component.html'
})
export class LoginComponent implements OnInit {
	public provider$ = this.state.getCurrent<IProvider>(STORE.provider);

	constructor(private readonly state: StateService, private readonly auth: AuthService) { }

	ngOnInit() { }
}