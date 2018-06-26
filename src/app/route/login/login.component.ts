import { Component } from '@angular/core';
import { Observable } from 'rxjs';

import { Select } from '@ngxs/store';
import { ClientState } from '@state/client.state';

import { AuthService } from '@dbase/auth/auth.service';
import { IProvider } from '@dbase/data/data.interface';
import { dbg } from '@lib/logger.library';

@Component({
  selector: 'wb-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  @Select(ClientState.providers) provider$!: Observable<IProvider[]>;

  private dbg: Function = dbg.bind(this);

  constructor(public readonly auth: AuthService) { }
}
