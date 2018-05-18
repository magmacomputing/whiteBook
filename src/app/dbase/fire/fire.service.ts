import { Injectable } from '@angular/core';
import { AngularFirestore, DocumentChangeAction } from 'angularfire2/firestore';

import { Store } from '@ngxs/store';
import { Observable, Subscription } from 'rxjs';
import { tap } from 'rxjs/operators';

import { DBaseModule } from '@app/dbase/dbase.module';
import { isFunction } from '@lib/object.library';
import { dbg } from '@lib/log.library';

@Injectable({
  providedIn: DBaseModule
})
export class FireService {
  private dbg: Function = dbg.bind(this);
  private listener: { [collection: string]: Subscription; } = {};

  constructor(private af: AngularFirestore, private store: Store) {
    this.init();
  }

  private init() {
    this.dbg('init');
    this.snapOn('/client', this.snapStore);
  }

  /** FireService will manage the sync of data from FireStore down to the client */
  public snapOn(collection: string, onNext?: (value: DocumentChangeAction<{}>[]) => void) {
    this.snapOff(collection);                 // turn off any prior Subscription

    this.listener[collection] = this.af.collection(collection)
      .snapshotChanges()
      .subscribe(snaps => this.dispatch(this.dbg, onNext, snaps))
  }

  public snapOff(collection: string) {
    if (this.listener[collection])
      this.listener[collection];
  }

  /** This is run as a callback */
  private dispatch(dbg: Function, onNext: (value: DocumentChangeAction<{}>[]) => void, snaps: DocumentChangeAction<{}>[]) {
    onNext(snaps);
  }

  private snapStore(snap: DocumentChangeAction<{}>[]) {
    snap.forEach(chg => this.dbg('chg: %j', chg.type));
  }

}
