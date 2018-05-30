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
  public snap!: Promise<any>;

  constructor(private af: AngularFirestore, private sync: SyncService, private readonly auth: AuthService, private store: Store) {
    this.dbg('new');
    this.sync.on(COLLECTION.Client, SLICE.client)     // initialize a listener to /client Collection
      .then(ready => this.snap(''))                   // try this to kick-start Observable
  }

  snap<T>(store: string, slice: string = SLICE.client) {
    return this.store
      .selectOnce<T[]>(state => state[slice][store])
      .toPromise()
  }

  off() {
    this.sync.off(COLLECTION.Client);
  }

  signIn(method: string) {
    this.dbg('signIn: %s', method);
  }

}
