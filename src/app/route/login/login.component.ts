import { Component } from '@angular/core';

import { STORE, FIELD } from '@dbase/data/data.define';
import { IProvider } from '@dbase/data/data.schema';
import { AuthService } from '@dbase/auth/auth.service';
import { StateService } from '@dbase/state/state.service';

@Component({
	selector: 'wb-login',
	templateUrl: './login.component.html'
})
export class LoginComponent {
	public provider$ = this.state.getCurrent<IProvider>(STORE.provider, undefined, ['sort', FIELD.key]);

	constructor(private readonly state: StateService, private readonly auth: AuthService) { }
}