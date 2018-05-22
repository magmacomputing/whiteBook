import { Injectable } from '@angular/core';
import { AngularFirestore } from 'angularfire2/firestore';

import { Observable } from 'rxjs';
import { Store, Select } from '@ngxs/store';
import { SLICE } from '@app/state/state.define';
import { IClientState } from '@app/state/client.state';

import { DBaseModule } from '@app/dbase/dbase.module';
import { SyncService } from '@app/dbase/sync/sync.service';

import { COLLECTION } from '@app/dbase/fire/fire.define';
import { dbg } from '@lib/log.library';

@Injectable({ providedIn: DBaseModule })
export class FireService {
  private dbg: Function = dbg.bind(this);

  constructor(private af: AngularFirestore, private sync: SyncService, private store: Store) {
    this.dbg('init');
    this.sync.on(COLLECTION.Client, SLICE.client);     // initialize a listener to /client Collection
  }

  snap(store: string) {
    this.store.selectOnce(state => state.client.provider)
      .subscribe(list => this.dbg('snap: %j', list))
  }

  off() {
    this.sync.off(COLLECTION.Client);
  }

}
