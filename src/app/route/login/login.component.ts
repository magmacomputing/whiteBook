import { Component } from '@angular/core';
import { Observable } from 'rxjs';
import { Select } from '@ngxs/store';
import { ClientState } from '@dbase/state/client.state';

import { STORE, FIELD } from '@dbase/data/data.define';
import { IProvider } from '@dbase/data/data.schema';
import { AuthService } from '@dbase/auth/auth.service';

@Component({
	selector: 'wb-login',
	templateUrl: './login.component.html',
	styleUrls: ['./login.component.css']
})
export class LoginComponent {
	@Select(ClientState.current(STORE.provider, undefined, ['sort', FIELD.key])) provider$!: Observable<IProvider[]>;

	constructor(private readonly auth: AuthService) { }
}