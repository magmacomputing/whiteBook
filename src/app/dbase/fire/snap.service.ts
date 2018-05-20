import { Injectable } from '@angular/core';
import { Subscription } from 'rxjs';

import { Store } from '@ngxs/store';
import { SetClient, DelClient } from '@app/state/client.action';
import { IClientSlice } from '@app/state/client.state';

import { DocumentChangeAction, AngularFirestore } from 'angularfire2/firestore';
import { DBaseModule } from '@app/dbase/dbase.module';
import { IListen } from '@app/dbase/fire/snap.define';

import { isFunction } from '@lib/object.library';
import { dbg } from '@lib/log.library';

@Injectable({ providedIn: DBaseModule })
export class SnapService {
  private dbg: Function = dbg.bind(this);
  private listener: { [collection: string]: IListen } = {}

  constructor(private af: AngularFirestore, private store: Store) {
    // this.dispatch.bind(this, this.dbg, this.store);
  }

  public snapOn(collection: string, slice: string,
    onNext?: (value: DocumentChangeAction<{}>[]) => void) {
    this.snapOff(collection);                 // turn off any prior Subscription

    this.listener[collection] = {
      slice: slice,
      next: onNext,
      subscribe: this.af.collection(collection)
        .snapshotChanges()
        .subscribe(chg => this.dispatch(this.dbg, this.store, chg))
    }
  }

  public snapOff(collection: string) {
    if (isFunction(this.listener[collection]))
      this.listener[collection];
  }

  private dispatch(dbg: Function, store: Store, snaps: DocumentChangeAction<{}>[]) {
    // snaps.forEach(snap => snap.payload.doc.data)
  }

  /** sync the public data */
  private snapClient(store: Store, snaps: DocumentChangeAction<IClientSlice>[]) {
    snaps.forEach(snap => {
      switch (snap.type) {
        case 'added':
        case 'modified':
          store.dispatch(new SetClient(snap.payload.doc.data()));
          break;
        case 'removed':
          store.dispatch(new DelClient(snap.payload.doc.data()));
      }
    })
  }
}
