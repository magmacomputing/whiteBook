import { Injectable } from '@angular/core';
import { DBaseModule } from '@dbase/dbase.module';

import { Observable } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import { Store, Select } from '@ngxs/store';
import { ClientState } from '@app/state/client.state';
import { IClientState } from '@app/state/client.define';

import { IAppDefault, IClient } from '@dbase/app/app.interface';
import { dbg } from '@lib/logger.library';

@Injectable({
  providedIn: DBaseModule
})
export class MemberService {
  private dbg: Function = dbg.bind(this);
  private APP_DEFAULT: IAppDefault[];
  // @Select() client$!: Observable<IClientState>;   // current Client tables

  constructor(private store: Store) {
    this.APP_DEFAULT = [											    // TODO: a mini-table to use for Default values, put into Store
      { type: 'price', amount: 15, },
      { type: 'topUp', amount: 150 },
      { type: 'hold', amount: 5 },
    ]
    this.dbg('new');
  }

  attend() {
    this.getClient('price')
      .then(tbl => this.dbg('price: %j', tbl));
  }

  /** get current values of a store-type from state */
  getClient(store: string) {
    return this.store
      .selectOnce(ClientState)
      .toPromise()
      .then(client => client[store])
  }
}