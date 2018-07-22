import { Injectable } from '@angular/core';
import { DBaseModule } from '@dbase/dbase.module';

import { tap } from 'rxjs/operators';
import { Store } from '@ngxs/store';
import { SLICE } from '@dbase/state/store.define';

import { filterTable } from '@dbase/app/app.library';
import { COLLECTION, FIELD, FILTER, STORES } from '@dbase/data/data.define';
import { IStoreMeta } from '@dbase/data/data.interface';
import { IWhere } from '@dbase/fire/fire.interface';
import { FireService } from '@dbase/fire/fire.service';
import { SyncService } from '@dbase/sync/sync.service';
import { AuthService } from '@dbase/auth/auth.service';

import { getStamp } from '@lib/date.library';
import { IObject } from '@lib/object.library';
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

  constructor(private fire: FireService, private sync: SyncService, private auth: AuthService, private store: Store) {
    this.dbg('new');
    this.syncOn(COLLECTION.Client, SLICE.client);   // initialize a listener to /client Collection
  }

  /** Make Store data available in a Promise */
  snap(store: string) {
    const slice = this.getSlice(store);
    return this.snapshot[store] = this.store
      .selectOnce<IStoreMeta[]>(state => state[slice][store])
      // .pipe(tap(list => this.dbg('snap[%s]: %j', store, list)))
      .toPromise()                                   // stash the current snap result
  }

  syncOn(collection: string, slice: string = SLICE.client) {
    return this.sync.on(collection, slice);         // init a listener to a collection
  }

  syncOff() {
    return this.sync.off(COLLECTION.Client);        // unsubscribe a collection's listener
  }

  getSlice(store: string) {
    const collections = Object.keys(STORES);
    return collections.filter(col => STORES[col].includes(store))[0];
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

  /** Expire any previous docs, and Insert new doc (default 'member' slice) */
  async insDoc(collection: string, doc: IStoreMeta) {
    const tstamp = doc[FIELD.effect] || getStamp();
    const where: IWhere[] = [{ fieldPath: FIELD.expire, opStr: '==', value: 0 }];
    const filter = FILTER[collection] || [];							// get the standard list of fields on which to filter

    if (!doc[FIELD.key] && filter.includes(FIELD.key)) {
      const user = await this.auth.user();          // get the current User's uid
      if (user.userInfo)
        doc[FIELD.key] = user.userInfo.uid;         // ensure uid is included on doc
    }

    filter.forEach(field => {
      if (doc[field])                               // if that field exists in the doc, add it to the filter
        where.push({ fieldPath: field, opStr: '==', value: doc[field] })
      else return Promise.reject(`missing required field: ${field}`)
    })

    const rows = await this.snap(doc.store)         // read the store
      .then(table => filterTable(table, where))     // filter the store to find current unexpired docs

    const batch = this.fire.bat();
    rows.forEach(row => {                           // set _expire on current doc(s)
      const ref = this.fire.docRef(collection, row[FIELD.id]);
      this.dbg('updDoc: %s => %j %s: %s', collection, ref.id, FIELD.expire, tstamp);
      batch.update(ref, { [FIELD.expire]: tstamp });
    })

    const docRef = this.fire.docRef(collection, doc[FIELD.id] || this.newId);
    if (rows.length)
      doc[FIELD.effect] = tstamp;                   // add an 'effective' date
    delete doc[FIELD.id];                           // remove the _id meta field from the document
    this.dbg('insDoc: %s => %j', collection, doc);

    batch.set(docRef, doc);                         // add the new Document
    return batch.commit()
      .catch(err => this.dbg('warn: %j', err))      // TODO: better manage errors
  }
}