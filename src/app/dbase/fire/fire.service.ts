import { Injectable } from '@angular/core';
import { AngularFirestore } from 'angularfire2/firestore';
import { DBaseModule } from '@dbase/dbase.module';

import { Store } from '@ngxs/store';
import { SLICE } from '@state/state.define';

import { COLLECTION } from '@dbase/fire/fire.define';
import { SyncService } from '@dbase/sync/sync.service';

import { dbg } from '@lib/logger.library';

@Injectable({ providedIn: DBaseModule })
export class FireService {
  private dbg: Function = dbg.bind(this);
  public ready!: Promise<boolean>;

  constructor(private af: AngularFirestore, private sync: SyncService, private store: Store) {
    this.dbg('new');
    this.sync.on(COLLECTION.Client, SLICE.client);     // initialize a listener to /client Collection
  }

  snap(store: string) {
    this.store.selectOnce(state => state[SLICE.client][store])
      .subscribe(list => this.dbg('snap: %j', list))
  }

  off() {
    this.sync.off(COLLECTION.Client);
  }

}
