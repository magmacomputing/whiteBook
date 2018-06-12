import { Injectable } from '@angular/core';
import { DBaseModule } from '@dbase/dbase.module';

import { Store } from '@ngxs/store';
import { ClientState } from '@app/state/client.state';
import { IClientState } from '@app/state/client.define';

import { asAt } from '@app/dbase/app/member.library';
import { dbg } from '@lib/logger.library';

@Injectable({ providedIn: DBaseModule })
export class MemberService {
  private dbg: Function = dbg.bind(this);

  constructor(private store: Store) {
    this.dbg('new');
  }

  async attend(event: string, date?: string) {
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