import { Component } from '@angular/core';
import { Observable } from 'rxjs';

import { Select } from '@ngxs/store';
import { ClientState } from '@state/client.state';

import { AuthService } from '@dbase/auth/auth.service';
import { IProvider } from '@dbase/app/app.interface';
import { dbg } from '@lib/logger.library';

@Component({
  selector: 'wb-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  private dbg: Function = dbg.bind(this);
  @Select(ClientState.providers) provider$!: Observable<IProvider[]>;
  // TODO: tidy
  // @Select(ClientState.getClient.bind(null, 'provider')) provider$!: Observable<IProvider[]>;

  constructor(public readonly auth: AuthService) { }
}
