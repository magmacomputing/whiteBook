import { Injectable } from '@angular/core';
import { DBaseModule } from '@dbase/dbase.module';

import { Observable } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import { Store, Select } from '@ngxs/store';
import { ClientState } from '@app/state/client.state';
import { IClientState, IClientDoc } from '@app/state/client.define';

import { IAppDefault, IClient } from '@dbase/app/app.interface';
import { dbg } from '@lib/logger.library';
import { SLICE } from '@app/state/state.define';
import { asAt } from '@app/dbase/app/member.library';

@Injectable({
  providedIn: DBaseModule
})
export class MemberService {
  private dbg: Function = dbg.bind(this);
  private APP_DEFAULT: IAppDefault[];

  constructor(private store: Store) {
    this.APP_DEFAULT = [											    // TODO: a mini-table to use for Default values, put into Store
      { type: 'price', amount: 15, },
      { type: 'topUp', amount: 150 },
      { type: 'hold', amount: 5 },
    ]
    this.dbg('new');
  }

  async attend() {
    const [prices, classes] = await Promise.all([
      this.getClient('price'),
      this.getClient('class'),
    ])

    this.dbg('class: %j', classes);
  }

  /** get current values of a store-type from state */
  getClient(store: string, allDocs: boolean = false) {
    return this.store
      .selectOnce(ClientState)
      .toPromise<IClientState>()
      .then(client => client[store])
      .then(docs => allDocs ? docs : asAt(docs))
  }
}