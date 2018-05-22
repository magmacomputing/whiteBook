import { Injectable } from '@angular/core';
import { DocumentChangeAction, AngularFirestore } from 'angularfire2/firestore';

import { Subscription } from 'rxjs';

import { Store } from '@ngxs/store';
import { SLICE } from '@app/state/state.define';
import { SetClient, DelClient, TruncClient } from '@app/state/client.action';
import { IClientDoc } from '@app/state/client.state';

import { DBaseModule } from '@app/dbase/dbase.module';
import { IListen, StoreStorage } from '@app/dbase/sync/sync.define';
import { FIELD, COLLECTION } from '@app/dbase/fire/fire.define';
import { IQuery } from '@app/dbase/fire/fire.interface';
import { fnQuery } from '@app/dbase/fire/fire.library';

import { isFunction } from '@lib/object.library';
import { getHash } from '@lib/utility.library';
import { dbg } from '@lib/log.library';
import { SnapshotMetadata } from '@firebase/firestore-types';

@Injectable({ providedIn: DBaseModule })
export class SyncService {
  private dbg: Function = dbg.bind(this);
  private listener: { [collection: string]: IListen } = {};
  private localStore: { [key: string]: any; }

  constructor(private af: AngularFirestore, private store: Store) {
    this.localStore = JSON.parse(localStorage.getItem(StoreStorage) || '{}');
  }

  /** establish a listener to a remote Collection, and sync to an NGXS Slice */
  public on(collection: string, slice: string, query?: IQuery) {
    const snapDetect = this.snapDetect.bind(this, collection);
    const hash: any = {};

    Object.keys(this.localStore[slice])
      .forEach(key => hash[key] = getHash(this.localStore[slice][key]))

    this.off(collection);                             // detach any prior Subscription
    this.listener[collection] = {
      slice: slice,
      cnt: -1,                                        // first snapshot will be '0'
      hash: hash,          // the slice hash from disk
      subscribe: this.af.collection(collection, fnQuery(query))
        .stateChanges()                               // only watch for changes since last snapshot
        .subscribe(snapDetect)
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
  private snapDetect(collection: string, snaps: DocumentChangeAction<IClientDoc>[]) {
    const slice = this.listener[collection].slice;
    this.listener[collection].cnt += 1;

    if (slice === SLICE.client)
      this.snapClient(snaps);
  }

  /** sync the public Client data */
  private snapClient(snaps: DocumentChangeAction<IClientDoc>[]) {
    const listen = this.listener[COLLECTION.Client];

    if (listen.cnt === 0) {                         // initial snapshot
      console.log('hash: ', listen.hash);
      // this.dbg('keys: %j', Object.keys(snaps));
      this.dbg('snap:');
      console.log(snaps[0]);
      const snapList: any[] = [];
      snaps.forEach(snap => snapList.push(snap.payload.doc.data()))
      console.log('calc: ', getHash(snapList));
      // if (listen.hash === getHash(snaps.))           // hash on storage same as incoming?
      return;                                     // already sync'd  
      // this.store.dispatch(new TruncClient());       // otherwise, reset Store
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
