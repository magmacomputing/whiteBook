import { Component } from '@angular/core';
import { Observable } from 'rxjs';
import { Select } from '@ngxs/store';
import { currStore } from '@dbase/state/store.state';

import { AuthService } from '@dbase/auth/auth.service';
import { STORE, FIELD } from '@dbase/data/data.define';
import { IProvider } from '@dbase/data/data.schema';

@Component({
	selector: 'wb-login',
	templateUrl: './login.component.html',
	styleUrls: ['./login.component.css']
})
export class LoginComponent {
	@Select((state: any) => currStore(state.client, STORE.provider, undefined, ['sort', FIELD.key])) provider$!: Observable<IProvider[]>;

	constructor(private readonly auth: AuthService) { }

}
