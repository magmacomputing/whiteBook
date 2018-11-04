import { Component, OnInit } from '@angular/core';

import { STORE, FIELD } from '@dbase/data/data.define';
import { IProvider } from '@dbase/data/data.schema';
import { AuthService } from '@dbase/auth/auth.service';
import { StateService } from '@dbase/state/state.service';
import { FireService } from '@dbase/fire/fire.service';

@Component({
	selector: 'wb-login',
	templateUrl: './login.component.html'
})
export class LoginComponent implements OnInit {
	public provider$ = this.state.getCurrent<IProvider>(STORE.provider);

	constructor(private readonly state: StateService, private readonly auth: AuthService) { }

	ngOnInit() { }

	signIn(provider: IProvider) {
		const opts: { email?: string, password?: string } = {};

		if (provider[FIELD.type] === 'email') {
			opts.email = prompt('Enter your email address...') || undefined;
			opts.password = prompt('Enter your password...') || undefined;
		}

		this.auth.signIn(provider, opts);
	}
}