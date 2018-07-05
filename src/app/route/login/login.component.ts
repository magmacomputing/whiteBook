import { Component } from '@angular/core';
import { Observable } from 'rxjs';

import { Select } from '@ngxs/store';
import { ClientState } from '@dbase/state/client.state';
import { ISelector } from '@dbase/state/store.define';
import { getStore } from '@dbase/state/store.state';

import { AuthService } from '@dbase/auth/auth.service';
import { STORE } from '@dbase/data/data.define';

@Component({
  selector: 'wb-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  @Select(ClientState.getClient) client$!: Observable<ISelector>;

  constructor(public readonly auth: AuthService) { }

  get provider$() {
  	return getStore(this.client$, STORE.provider, undefined, ['type', 'order', 'name']);
  }
}
