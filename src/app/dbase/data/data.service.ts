import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material';
import { DBaseModule } from '@dbase/dbase.module';

import { Store } from '@ngxs/store';
import { SLICE } from '@dbase/state/store.define';

import { COLLECTION, FIELD } from '@dbase/data/data.define';
import { IStoreMeta, IStoreBase, IMeta } from '@dbase/data/data.schema';
import { getWhere, updPrep, getSlice } from '@dbase/data/data.library';
import { IWhere } from '@dbase/fire/fire.interface';
import { FireService } from '@dbase/fire/fire.service';
import { SyncService } from '@dbase/sync/sync.service';
import { AuthService } from '@dbase/auth/auth.service';
import { asAt } from '@dbase/app/app.library';

import { getStamp } from '@lib/date.library';
import { IObject, asArray } from '@lib/object.library';
import { dbg } from '@lib/logger.library';

/**
 * The DataService is responsible for managing the syncing between
 * the local State (ngxs 'Store') and the remote DataBase (Firebase Firestore).  
 * The intention is that all 'reads' are from State, and all 'writes' are to a persisted
 * local copy of the Database (which FireStore will sync back to the server).
 */
@Injectable({ providedIn: DBaseModule })
export class DataService {
  private dbg: Function = dbg.bind(this);
  public snapshot: IObject<Promise<IStoreMeta[]>> = {};

  constructor(private fire: FireService, private sync: SyncService, private auth: AuthService, private store: Store, private snack: MatSnackBar) {
    this.dbg('new');
    this.syncOn(COLLECTION.Client, SLICE.client);   // initialize a listener to /client Collection
  }

  /** Make Store data available in a Promise */
  snap(store: string) {
    const slice = getSlice(store);
    return this.snapshot[store] = this.store
      .selectOnce<IStoreMeta[]>(state => state[slice][store])
      .toPromise()                                   // stash the current snap result
  }

  syncOn(collection: string, slice: string = SLICE.client) {
    return this.sync.on(collection, slice);         // init a listener to a collection
  }

  syncOff() {
    return this.sync.off(COLLECTION.Client);        // unsubscribe a collection's listener
  }

  getMeta(store: string, docId: string) {
    const collection = getSlice(store);
    return collection
      ? this.fire.getMeta(collection, docId)
      : Promise.reject(`Cannot determine slice: ${store}`)
  }

  get newId() {
    return this.fire.newId();                       // get Firebase to generate a new Key
  }

  setDoc(store: string, doc: IObject<any>) {
    return this.fire.setDoc(store, doc);
  }

  updDoc(store: string, docId: string, data: IObject<any>) {
    return this.fire.updDoc(store, docId, data);
  }

  /** Expire any previous docs, and Insert new doc */
  insDoc(nextDocs: IStoreBase | IStoreBase[]) {
    const creates: IStoreBase[] = [];
    const updates: IStoreBase[] = [];
    const deletes: IStoreBase[] = [];
    const auth = this.auth.state();                         // get the current User's uid

    const promises = asArray(nextDocs).map(async nextDoc => {
      let tstamp = nextDoc[FIELD.effect] || getStamp();      // the position in the date-range to Insert
      const where: IWhere[] | void = await getWhere(nextDoc as IStoreMeta, auth)
        .catch(err => { this.snack.open(err.message) });
      if (!where) return;

      const currDocs = await this.snap(nextDoc[FIELD.store])// read the store
        .then(table => asAt(table, where, tstamp))          // find where to insert new doc (generally max one-prevDoc expected)
        .then(table => updPrep(table, tstamp, this.fire))   // prepare the updates to effect/expire

      if (currDocs.updates.length) {
        if (currDocs.stamp > 0)
          nextDoc[FIELD.effect] = currDocs.stamp;           // if the updPrep changed the effective-date
        else nextDoc[FIELD.expire] = -currDocs.stamp;       // 
      }
      creates.push(nextDoc);
      updates.push(...currDocs.updates);
    })

    return Promise.all(promises)                           // collect all the Creates/Updates/Deletes
      .then(_ => this.fire.batch(creates, updates, deletes))  // then batch write
  }
}