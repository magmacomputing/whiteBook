import { Injectable } from '@angular/core';
import { AngularFirestore } from 'angularfire2/firestore';
import { DBaseModule } from '@dbase/dbase.module';

import { tap } from 'rxjs/operators';
import { Store } from '@ngxs/store';
import { SLICE } from '@state/state.define';

import { COLLECTION } from '@dbase/fire/fire.define';
import { SyncService } from '@dbase/sync/sync.service';
import { AuthService } from '@dbase/auth/auth.service';

import { dbg } from '@lib/logger.library';
import { cryptoHash } from '@app/library/crypto.library';

@Injectable({ providedIn: DBaseModule })
export class FireService {
  private dbg: Function = dbg.bind(this);
  public snapshot: { [store: string]: Promise<any[]>; } = {};

  constructor(private af: AngularFirestore, private sync: SyncService, private auth: AuthService, private store: Store) {
    this.dbg('new');
    this.syncOn(COLLECTION.Client, SLICE.client)      // initialize a listener to /client Collection
      .then(_ => this.snap(''))                       // try this to kick-start Observable
  }

  /** Make Store data available in a Promise */
  snap<T>(store: string, slice: string = SLICE.client) {
    return this.snapshot[store] = this.store
      .selectOnce<T[]>(state => state[slice][store])
      .pipe(tap(list => { if (list) { this.dbg(`snap[${store}]: %j`, list || 'init'); } }))
      .toPromise()                                   // stash the current snap result
  }

  syncOn(collection: string, slice: string = SLICE.client) {
    return this.sync.on(collection, slice);
  }

  syncOff() {
    return this.sync.off(COLLECTION.Client);
  }

  hash(str: string) {
    return cryptoHash(str)
      .then(hash => { this.dbg('hash: %s', hash); return hash; })
  }
}