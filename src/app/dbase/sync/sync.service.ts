import { Injectable } from '@angular/core';
import { DocumentChangeAction, AngularFirestore } from 'angularfire2/firestore';
import { SnapshotMetadata } from '@firebase/firestore-types';

import { Subscription } from 'rxjs';

import { Store } from '@ngxs/store';
import { SLICE } from '@state/state.define';
import { SetClient, DelClient, TruncClient } from '@state/client.action';
import { IClientDoc } from '@state/client.state';

import { DBaseModule } from '@dbase/dbase.module';
import { IListen, StoreStorage, StoreHash } from '@dbase/sync/sync.define';
import { FIELD, COLLECTION } from '@dbase/fire/fire.define';
import { IQuery } from '@dbase/fire/fire.interface';
import { fnQuery } from '@dbase/fire/fire.library';

import { isFunction, sortKeys } from '@lib/object.library';
import { getHash } from '@lib/utility.library';
import { dbg } from '@lib/log.library';

@Injectable({ providedIn: DBaseModule })
export class SyncService {
  private dbg: Function = dbg.bind(this);
  private listener: { [collection: string]: IListen } = {};
  private localStore: { [key: string]: any; };

  constructor(private af: AngularFirestore, private store: Store) {
    this.localStore = JSON.parse(localStorage.getItem(StoreStorage) || '{}');
  }

  /** establish a listener to a remote Collection, and sync to an NGXS Slice */
  public async on(collection: string, slice: string, query?: IQuery) {
    const snapDispatch = this.snapDispatch.bind(this, collection);

    this.off(collection);                             // detach any prior Subscription
    this.listener[collection] = {
      slice: slice,
      cnt: -1,                                        // '-1' is not-yet-snapped, '0' is first snapshot
      subscribe: this.af.collection(collection, fnQuery(query))
        .stateChanges()                               // only watch for changes since last snapshot
        .subscribe(snapDispatch)
    }
  }

  /** detach an existing snapshot listener */
  public off(collection: string) {
    const listen = this.listener[collection];

    if (isFunction(listen && listen.subscribe.unsubscribe)) {
      listen.subscribe.unsubscribe();
      this.dbg('off: %s', collection);
    }
    delete this.listener[collection];
  }

  /** handler for snapshot listeners */
  private snapDispatch(collection: string, snaps: DocumentChangeAction<IClientDoc>[]) {
    const slice = this.listener[collection].slice;
    this.listener[collection].cnt += 1;

    if (slice === SLICE.client)
      this.snapClient(snaps);
  }

  /** sync the public Client data */
  private async snapClient(snaps: DocumentChangeAction<IClientDoc>[]) {
    const listen = this.listener[COLLECTION.Client];

    if (listen.cnt === 0) {                         // initial snapshot
      const localStore = this.localStore[SLICE.client] || {};
      const localList: IClientDoc[] = [];
      const snapList = snaps.map(snap => Object.assign({}, { [FIELD.id]: snap.payload.doc.id }, snap.payload.doc.data()));

      Object.keys(localStore).forEach(key => localList.push(...localStore[key]));
      let [localHash, storeHash] = await Promise.all([
        getHash(localList.sort(sortKeys([FIELD.store, FIELD.id]))),
        getHash(snapList.sort(sortKeys([FIELD.store, FIELD.id])))
      ])
      if (localHash === storeHash)
        return;                                     // already sync'd  
      this.store.dispatch(new TruncClient());       // otherwise, reset Store
    }

    snaps.forEach(snap => {
      const data = Object.assign({}, { [FIELD.id]: snap.payload.doc.id }, snap.payload.doc.data());

      switch (snap.type) {
        case 'added':
        case 'modified':
          this.store.dispatch(new SetClient(data));
          break;

        case 'removed':
          this.store.dispatch(new DelClient(data));
          break;
      }
    })
  }

  private getSource(meta: SnapshotMetadata) {
    return meta.fromCache
      ? 'cache'
      : meta.hasPendingWrites
        ? 'local'
        : 'server'
  }
}
