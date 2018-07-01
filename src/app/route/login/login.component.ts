import { Component } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { Select } from '@ngxs/store';
import { ClientState } from '@dbase/state/client.state';
import { IStoreDoc } from '@dbase/state/store.define';

import { AuthService } from '@dbase/auth/auth.service';
import { STORE } from '@dbase/data/data.define';

@Component({
  selector: 'wb-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  @Select(ClientState.getClient) client$!:
    Observable<(store: string, type?: string, ...keys: string[]) => IStoreDoc[]>;

  constructor(public readonly auth: AuthService) { }

  get provider$() {
    return this.client$.pipe(map(fn => fn(STORE.provider, undefined, 'type', 'order', 'name')));
  }
}
