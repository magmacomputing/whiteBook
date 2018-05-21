import { Injectable } from '@angular/core';
import { AngularFirestore } from 'angularfire2/firestore';

import { Observable } from 'rxjs';
import { Store, Select } from '@ngxs/store';
import { IClientState } from '@app/state/client.state';

import { DBaseModule } from '@app/dbase/dbase.module';
import { SnapService } from '@app/dbase/fire/snap.service';

import { COLLECTION } from '@app/dbase/fire/fire.define';
import { dbg } from '@lib/log.library';

@Injectable({ providedIn: DBaseModule })
export class FireService {
  @Select((state: any) => state.client) client$!: Observable<IClientState | null>;
  private dbg: Function = dbg.bind(this);

  constructor(private af: AngularFirestore, private snap: SnapService, private store: Store) {
    this.dbg('init');
    snap.on(COLLECTION.Client, 'client');       // initialize a listener to /client Collection
  }

}
