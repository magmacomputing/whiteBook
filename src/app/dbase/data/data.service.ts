import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material';
import { DBaseModule } from '@dbase/dbase.module';

import { Store } from '@ngxs/store';
import { SLICE } from '@dbase/state/store.define';

import { COLLECTION, FIELD, FILTER, STORES } from '@dbase/data/data.define';
import { IStoreMeta } from '@dbase/data/data.interface';
import { IWhere } from '@dbase/fire/fire.interface';
import { FireService } from '@dbase/fire/fire.service';
import { SyncService } from '@dbase/sync/sync.service';
import { AuthService } from '@dbase/auth/auth.service';

import { getStamp } from '@lib/date.library';
import { IObject } from '@lib/object.library';
import { asAt } from '@dbase/app/member.library';
import { dbg } from '@lib/logger.library';
import { insPrep } from '@dbase/data/data.library';
import { isUndefined } from 'util';


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
    const slice = this.getSlice(store);
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

  private getSlice(store: string) {                 // determine the slice based on the 'store' field
    return Object.keys(STORES)
      .filter(col => STORES[col].includes(store))[0];
  }

  getMeta(store: string, docId: string) {
    const collection = this.getSlice(store);
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
  async insDoc(nextDoc: IStoreMeta) {
    let tstamp = nextDoc[FIELD.effect] || getStamp();// the position in the date-range to Insert
    const collection = this.getSlice(nextDoc[FIELD.store]);
    const where: IWhere[] = await insPrep(collection, nextDoc);

    const prevDocs = await this.snap(nextDoc[FIELD.store]) // read the store
      .then(table => asAt(table, where, tstamp))    // find where to insert new prevDoc (generally max one-prevDoc expected)

    const batch = this.fire.bat();
    prevDocs.forEach(async prevDoc => {             // loop through existing-docs first, to determine effect/expire range
      const ref = this.fire.docRef(collection, prevDoc[FIELD.id]);
      const dates: { [FIELD.effect]?: number, [FIELD.expire]?: number } = {};
      let effect = prevDoc[FIELD.effect] || 0;

      if (!effect) {                                // the _create field is currently only available from the server
        const meta = await this.getMeta(prevDoc[FIELD.store], prevDoc[FIELD.id]);
        effect = meta[FIELD.create];
      }

      if (tstamp < effect) {
        dates[FIELD.effect] = effect;               // set the effective-date for the existing row
        tstamp = effect;                            // set the date-boundary
      } else {
        dates[FIELD.expire] = effect;               // set the expiry-date the existing row
      }

      this.dbg('updDoc: %s => %s %j', collection, ref.id, dates);
      batch.update(ref, dates);
    })

    const ref = this.fire.docRef(collection, nextDoc[FIELD.id] || this.newId);
    delete nextDoc[FIELD.id];                           // remove the _id meta field from the document
    // if (prevDocs.length)
    //   nextDoc[FIELD.effect] = tstamp;
    this.dbg('insDoc: %s => %j', collection, nextDoc);

    batch.set(ref, nextDoc);                            // add the new Document
    return batch.commit()
      .catch(err => this.dbg('warn: %j', err))      // TODO: better manage errors
  }
}