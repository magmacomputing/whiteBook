import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';

import { STORE, FIELD } from '@dbase/data/data.define';
import { IProvider } from '@dbase/data/data.schema';
import { AuthService } from '@dbase/auth/auth.service';
import { StateService } from '@dbase/state/state.service';

@Component({
	selector: 'wb-login',
	templateUrl: './login.component.html'
})
export class LoginComponent implements OnInit {
	public provider$!: Observable<IProvider[]>;

	constructor(private readonly state: StateService, private readonly auth: AuthService) { }

	ngOnInit() {
		this.provider$ = this.state.getCurrent<IProvider>(
			STORE.provider, undefined, ['sort', FIELD.key]
		)
	}
}