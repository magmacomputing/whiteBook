import { Component, OnInit } from '@angular/core';

import { STORE, FIELD } from '@dbase/data/data.define';
import { IProvider } from '@dbase/data/data.schema';
import { AuthService } from '@dbase/auth/auth.service';
import { StateService } from '@dbase/state/state.service';
import { DataService } from '@dbase/data/data.service';

import { dbg } from '@lib/logger.library';

@Component({
	selector: 'wb-login',
	templateUrl: './login.component.html'
})
export class LoginComponent implements OnInit {
	public provider$ = this.state.getCurrent<IProvider>(STORE.provider);
	private dbg: Function = dbg.bind(this);

	constructor(private readonly state: StateService, private readonly auth: AuthService, private readonly data: DataService) { }

	ngOnInit() { }

	signIn(provider: IProvider) {
		const opts: { email?: string, password?: string } = {};

		if (provider[FIELD.type] === 'email') {
			opts.email = prompt('Enter your email address...') || undefined;
			opts.password = prompt('Enter your password...') || undefined;
		}

		this.auth.signIn(provider, opts);

		// this.data.getMeta('provider', 'ASHmpwKiE7fEBrhu9xwM')
		// .then(meta => this.dbg('meta: %j', meta));

		// this.data.getToken(provider)
		// 	.then((token: string) => this.dbg('token: %j', token));
		// .then(meta => console.log('meta: ', meta));

	}
}