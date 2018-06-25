import { Injectable } from '@angular/core';
import { AngularFirestore } from 'angularfire2/firestore';
import { DBaseModule } from '@dbase/dbase.module';

import { tap } from 'rxjs/operators';
import { Store } from '@ngxs/store';
import { SLICE, IStoreDoc } from '@state/store.define';

import { IWhere } from '@dbase/fire/fire.interface';
import { COLLECTION, FIELD, FILTER } from '@dbase/fire/fire.define';
import { SyncService } from '@dbase/sync/sync.service';
import { AuthService } from '@dbase/auth/auth.service';

import { cryptoHash } from '@lib/crypto.library';
import { getStamp } from '@lib/date.library';
import { dbg } from '@lib/logger.library';
import { filterArray } from '@app/dbase/fire/fire.library';

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

    filter.forEach(field => {
      if (doc[field])                               // if that field exists in the doc, add it to the filter
        where.push({ fieldPath: field, opStr: '==', value: doc[field] })
    })

    const curr = await this.snap(store, slice)      // read the store
      .then(table => filterArray(table, where))     // filter the store to find current unexpired docs

    const batch = this.af.firestore.batch();
    curr.forEach(doc => {                           // set _expire on current doc(s)
      const ref = this.af.firestore.collection(store).doc(doc[FIELD.id]);
      batch.update(ref, { [FIELD.expire]: tstamp });
    })

    const ref = this.af.firestore.collection(store).doc();
    const user = await this.auth.user();
    if (!doc.uid && user.userInfo)
      doc.uid = user.userInfo.uid
    batch.set(ref, doc);                            // add the new Document

    batch.commit();
  }
}