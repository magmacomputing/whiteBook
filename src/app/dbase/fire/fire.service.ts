import { Injectable } from '@angular/core';
import { AngularFirestore, DocumentChangeAction } from 'angularfire2/firestore';

import { Store } from '@ngxs/store';
import { Observable, Subscription } from 'rxjs';
import { tap } from 'rxjs/operators';

import { DBaseModule } from '@app/dbase/dbase.module';
import { SnapService } from '@app/dbase/fire/snap.service';
import { AuthService } from '@app/dbase/auth/auth.service';

import { isFunction } from '@lib/object.library';
import { dbg } from '@lib/log.library';

@Injectable({ providedIn: DBaseModule })
export class FireService {
  private dbg: Function = dbg.bind(this);

  constructor(private af: AngularFirestore, private snap: SnapService, private store: Store) {
    this.dbg('init');
    this.snapOn('client', 'public');
  }

  /** FireService will manage the sync of data from FireStore down to the client */
  public snapOn(collection: string, slice: string, onNext?: (value: DocumentChangeAction<{}>[]) => void) {
    this.snap.snapOn(collection, slice, onNext);
  }

  public snapOff(collection: string) {
    this.snap.snapOff(collection);
  }

  /** This is run as a callback */
  private dispatch(dbg: Function, onNext: (value: DocumentChangeAction<{}>[]) => void, snaps: DocumentChangeAction<{}>[]) {
    onNext(snaps);
  }

  private snapStore(snap: DocumentChangeAction<{}>[]) {
    snap.forEach(chg => this.dbg('chg: %j', chg.type));
  }

}
