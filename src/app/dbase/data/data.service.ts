import { Injectable } from '@angular/core';
import { DBaseModule } from '@dbase/dbase.module';

import { tap } from 'rxjs/operators';
import { Store } from '@ngxs/store';
import { SLICE } from '@dbase/state/store.define';

import { filterArray } from '@dbase/app/app.library';
import { COLLECTION, FIELD, FILTER } from '@dbase/data/data.define';
import { IStoreMeta } from '@dbase/data/data.interface';
import { IWhere } from '@dbase/fire/fire.interface';
import { FireService } from '@dbase/fire/fire.service';
import { SyncService } from '@dbase/sync/sync.service';
import { AuthService } from '@dbase/auth/auth.service';

import { cryptoHash } from '@lib/crypto.library';
import { getStamp } from '@lib/date.library';
import { IObject } from '@lib/object.library';
import { dbg } from '@lib/logger.library';

/**
 * DataService is responsible for managing the syncing between the local State (ngxs 'Store')
 * and the remote DataBase ('DBaseService').  
 * The intention is that all 'reads' are from State, and all 'writes' are to a persisted
 * local copy of the Database (which FireStore will sync back to the server).
 */
@Injectable({ providedIn: DBaseModule })
export class DataService {
  private dbg: Function = dbg.bind(this);
  public snapshot: IObject<Promise<IStoreMeta[]>> = {};

  constructor(private fire: FireService, private sync: SyncService, private auth: AuthService, private store: Store) {
    this.dbg('new');
    this.syncOn(COLLECTION.Client, SLICE.client)      // initialize a listener to /client Collection
    // .then(_ => this.snap(''))                       // try this to kick-start Observable
  }

  /** Make Store data available in a Promise */
  snap(store: string, slice: string = SLICE.client) {
    return this.snapshot[store] = this.store
      .selectOnce<IStoreMeta[]>(state => state[slice][store])
      .pipe(tap(list => { if (list) { this.dbg(`snap[${store}]: %j`, list || 'init'); } }))
      .toPromise()                                   // stash the current snap result
  }

  syncOn(collection: string, slice: string = SLICE.client) {
    return this.sync.on(collection, slice);
  }

  syncOff() {
    return this.sync.off(COLLECTION.Client);
  }

  get newId() {
    return this.fire.newId();                       // get Firebase to generate a new Key
  }

  hash(str: string) {
    return cryptoHash(str)
      .then(hash => { this.dbg('hash: %s', hash); return hash; })
  }

  /** Expire any previous docs, and Insert new doc (default 'member' slice) */
  async insDoc(store: string, doc: IStoreMeta, slice: string = SLICE.member) {
    const tstamp = getStamp();
    const where: IWhere[] = [{ fieldPath: FIELD.expire, opStr: '==', value: 0 }];
    const filter = FILTER[store] || [];							// get the standard list of fields on which to filter

    if (!doc.uid && filter.includes('uid')) {
      const user = await this.auth.user();          // get the current User's uid
      if (user.userInfo)
        doc.uid = user.userInfo.uid;                // ensure uid is included on doc
    }
    filter.forEach(field => {
      if (doc[field])                               // if that field exists in the doc, add it to the filter
        where.push({ fieldPath: field, opStr: '==', value: doc[field] })
      else return Promise.reject(`missing required field: ${field}`)
    })
    // this.dbg('where: %s, %s, %j', store, slice, where);
    // this.dbg('table: %j', await this.snap(doc.store, slice));
    const rows =
      await this.snap(doc.store, slice)             // read the store
        .then(table => filterArray(table, where))   // filter the store to find current unexpired docs
    // this.dbg('rows: %j', rows);

    const batch = this.fire.bat();
    rows.forEach(row => {                           // set _expire on current doc(s)
      const ref = this.fire.docRef(store, row[FIELD.id]);
      this.dbg('updDoc: %s => %j', store, ref.id);
      batch.update(ref, { [FIELD.expire]: tstamp });
    })

    this.dbg('insDoc: %s => %j', store, doc);
    const docRef = this.fire.docRef(store, doc[FIELD.id]);
    delete doc[FIELD.id];                           // remove the _id meta field from the document

    batch.set(docRef, doc);                         // add the new Document
    batch.commit()
      .catch(err => this.dbg('warn: %j', err))      // TODO: better manage errors
  }
}