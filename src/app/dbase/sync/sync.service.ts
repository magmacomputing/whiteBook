import { Injectable } from '@angular/core';
import { SnapshotMetadata } from '@firebase/firestore-types';
import { DocumentChangeAction, AngularFirestore } from 'angularfire2/firestore';

import { Subscription } from 'rxjs';

import { Store } from '@ngxs/store';
import { SetClient, DelClient } from '@app/state/client.action';
import { IClientDoc } from '@app/state/client.state';

import { DBaseModule } from '@app/dbase/dbase.module';
import { IListen } from '@app/dbase/sync/sync.define';
import { FIELD } from '@app/dbase/fire/fire.define';

import { isFunction } from '@lib/object.library';
import { dbg } from '@lib/log.library';

@Injectable({ providedIn: DBaseModule })
export class SyncService {
  private dbg: Function = dbg.bind(this);
  private listener: { [collection: string]: IListen } = {}

  constructor(private af: AngularFirestore, private store: Store) { }

  /** establish a listener to a remote Collection, and sync to an NGXS Slice */
  public on(collection: string, slice: string) {
    const snapDetect = this.snapDetect.bind(this, collection)
    this.off(collection);                 // detach any prior Subscription

    this.listener[collection] = {
      slice: slice,
      subscribe: this.af.collection(collection)
        .stateChanges()                   // only watch for changes since last snapshot
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

    if (slice === 'client')
      this.snapClient(snaps);
  }

  /** sync the public Client data */
  private snapClient(snaps: DocumentChangeAction<IClientDoc>[]) {
    snaps.forEach(snap => {
      const data = Object.assign({}, { [FIELD.id]: snap.payload.doc.id }, snap.payload.doc.data());

      switch (snap.type) {
        case 'added':
        case 'modified':
          if (this.getSource(snap.payload.doc.metadata) !== 'cache')
            this.store.dispatch(new SetClient(data));
          break;

        case 'removed':
          this.store.dispatch(new DelClient(data));
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
