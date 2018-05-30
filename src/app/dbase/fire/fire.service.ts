import { Injectable } from '@angular/core';
import { AngularFirestore } from 'angularfire2/firestore';
import { DBaseModule } from '@dbase/dbase.module';

import { Store } from '@ngxs/store';
import { SLICE } from '@state/state.define';

import { COLLECTION } from '@dbase/fire/fire.define';
import { SyncService } from '@dbase/sync/sync.service';
import { AuthService } from '@dbase/auth/auth.service';

import { dbg } from '@lib/logger.library';

@Injectable({ providedIn: DBaseModule })
export class FireService {
  private dbg: Function = dbg.bind(this);
  public ready!: Promise<boolean>;
  public snapshot: { [store: string]: Promise<any[]>; } = {};

  constructor(private af: AngularFirestore, private sync: SyncService, private readonly auth: AuthService, private store: Store) {
    this.dbg('new');
    this.sync.on(COLLECTION.Client, SLICE.client)     // initialize a listener to /client Collection
      .then(ready => this.snap(''))                   // try this to kick-start Observable
  }

  /** Make Store data available in a Promise */
  snap<T>(store: string, slice: string = SLICE.client) {
    return this.snapshot[store] = this.store
      .selectOnce<T[]>(state => state[slice][store])
      .toPromise()          // stash the current snap result
      .then(list => {
        if (list)
          this.dbg(`snap[${store}]: %j`, list);
        return list;
      })
  }

  off() {
    this.sync.off(COLLECTION.Client);
  }

  signIn(providerId: string) {
    this.dbg('signIn: %s', providerId);
  }

}
