import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { Select } from '@ngxs/store';
import { SLICE } from '@state/state.define';
import { ClientState } from '@state/client.state';
import { IClientState } from '@state/client.define';

import { FIELD } from '@dbase/fire/fire.define';
import { IProvider } from '@func/app/app.interface';
import { dbg } from '@lib/logger.library';

@Component({
  selector: 'wb-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  private dbg: Function = dbg.bind(this);
  @Select((state: any) => state[SLICE.client]['provider']
    .filter((itm: any) => !itm[FIELD.expire]))
  providers!: Observable<IProvider[]>;

  constructor() { }

  ngOnInit() { }
}
