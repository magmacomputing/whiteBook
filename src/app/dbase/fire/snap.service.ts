import { Injectable } from '@angular/core';
import { Subscription } from 'rxjs';

import { Store } from '@ngxs/store';
import { SetClient, DelClient } from '@app/state/client.action';
import { IClientDoc } from '@app/state/client.state';

import { DocumentChangeAction, AngularFirestore } from 'angularfire2/firestore';
import { DBaseModule } from '@app/dbase/dbase.module';
import { IListen, IDocumentChange } from '@app/dbase/fire/snap.define';

import { isFunction } from '@lib/object.library';
import { dbg } from '@lib/log.library';

@Injectable({ providedIn: DBaseModule })
export class SnapService {
  private dbg: Function = dbg.bind(this);
  private listener: { [collection: string]: IListen } = {}

  constructor(private af: AngularFirestore, private store: Store) { }

  public on(collection: string, slice: string, onNext?: IDocumentChange<any>) {
    const next = this.dispatch.bind(this, collection, slice)
    this.off(collection);                 // turn off any prior Subscription

    this.listener[collection] = {
      slice: slice,
      next: next,
      subscribe: this.af.collection(collection)
        .snapshotChanges()
        .subscribe(next)
    }
  }

  public off(collection: string) {
    if (isFunction(this.listener[collection]))
      this.listener[collection];
  }

  private dispatch(collection: string, slice: string, snaps: DocumentChangeAction<IClientDoc>[]) {
    this.dbg('dispatch');
    this.dbg(this.store);
    if (slice === 'client')
      this.snapClient(snaps);
    // snaps.forEach(snap => snap.payload.doc.data)
  }

  /** sync the public data */
  private snapClient(snaps: DocumentChangeAction<IClientDoc>[]) {
    snaps.forEach(snap => {
      this.dbg('snap: %s, %s', snap.type, snap.payload.doc.id, snap.payload.doc.data().store);
      switch (snap.type) {
        case 'added':
        case 'modified':
          // this.store.dispatch(new SetClient(snap.payload.doc.data()));
          break;

        case 'removed':
        // this.store.dispatch(new DelClient(snap.payload.doc.data()));
      }
    })
  }
}
