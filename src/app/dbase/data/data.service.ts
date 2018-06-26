import { Injectable } from '@angular/core';
import { DBaseModule } from '@dbase/dbase.module';

import { tap } from 'rxjs/operators';
import { Store } from '@ngxs/store';
import { SLICE, IStoreDoc } from '@state/store.define';

import { filterArray } from '@dbase/app/app.library';
import { COLLECTION, FIELD, FILTER } from '@dbase/data/data.define';
import { IWhere } from '@dbase/data/fire.interface';
import { FireService } from '@dbase/data/fire.service';
import { SyncService } from '@dbase/sync/sync.service';
import { AuthService } from '@dbase/auth/auth.service';

import { cryptoHash } from '@lib/crypto.library';
import { getStamp } from '@lib/date.library';
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
  public snapshot: { [store: string]: Promise<any[]>; } = {};

  constructor(private fire: FireService, private sync: SyncService, private auth: AuthService, private store: Store) {
    this.dbg('new');
    this.syncOn(COLLECTION.Client, SLICE.client)      // initialize a listener to /client Collection
      .then(_ => this.snap(''))                       // try this to kick-start Observable
  }

  /** Make Store data available in a Promise */
  snap(store: string, slice: string = SLICE.client) {
    return this.snapshot[store] = this.store
      .selectOnce<IStoreDoc[]>(state => state[slice][store])
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

  /** Expire any previous docs, and Insert new doc (default 'member' slice) */
  async ins(store: string, doc: any, slice: string = SLICE.member) {
    const tstamp = getStamp();
    const where: IWhere[] = [{ fieldPath: FIELD.expire, opStr: '==', value: 0 }];
    const filter = FILTER[store] || [];							// get the standard list of fields on which to filter
    const user = await this.auth.user();

    if (!doc.uid && user.userInfo && filter.includes('uid'))
      doc.uid = user.userInfo.uid;                  // ensure current User uid is included on doc

    filter.forEach(field => {
      if (doc[field])                               // if that field exists in the doc, add it to the filter
        where.push({ fieldPath: field, opStr: '==', value: doc[field] })
      else return Promise.reject(`missing required field: ${field}`)
    })

    const curr = await this.snap(store, slice)      // read the store
      .then(table => filterArray(table, where))     // filter the store to find current unexpired docs

    const batch = this.fire.bat();
    curr.forEach(doc => {                           // set _expire on current doc(s)
      const ref = this.fire.ref(store, doc[FIELD.id]);
      batch.update(ref, { [FIELD.expire]: tstamp });
    })

    batch.set(this.fire.ref(store), doc);           // add the new Document
    batch.commit();
  }
}