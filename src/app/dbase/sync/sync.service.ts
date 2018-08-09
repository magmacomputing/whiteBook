import { Injectable } from '@angular/core';
import { SnapshotMetadata } from '@firebase/firestore-types';
import { DocumentChangeAction } from 'angularfire2/firestore';

import { Store } from '@ngxs/store';
import { SLICE, IStoreDoc } from '@dbase/state/store.define';
import { SetClient, DelClient, TruncClient } from '@dbase/state/store.define';
import { SetMember, DelMember, TruncMember } from '@dbase/state/store.define';
import { SetAttend, DelAttend, TruncAttend } from '@dbase/state/store.define';

import { IListen, StoreStorage } from '@dbase/sync/sync.define';
import { LoginToken, Logout } from '@dbase/state/auth.define';
import { FIELD, STORE } from '@dbase/data/data.define';
import { DBaseModule } from '@dbase/dbase.module';
import { FireService } from '@dbase/fire/fire.service';
import { IQuery } from '@dbase/fire/fire.interface';

import { isFunction, sortKeys, IObject } from '@lib/object.library';
import { createPromise } from '@lib/utility.library';
import { cryptoHash } from '@lib/crypto.library';
import { dbg } from '@lib/logger.library';
import { Navigate } from '@ngxs/router-plugin';
import { ROUTE } from '@route/route.define';

@Injectable({ providedIn: DBaseModule })
export class SyncService {
  private dbg: Function = dbg.bind(this);
  private listener: IObject<IListen>;
  private localStore: IObject<any>;

  constructor(private fire: FireService, private store: Store) {
    this.dbg('new');
    this.listener = {};
    this.localStore = JSON.parse(localStorage.getItem(StoreStorage) || '{}');
  }

  /** establish a listener to a remote Collection, and sync to an NGXS Slice */
  public async on(collection: string, slice?: string, query?: IQuery) {
    const sync = this.sync.bind(this, collection);
    const ready = createPromise<boolean>();
    slice = slice || collection;                      // default to same-name as collection

    this.off(collection);                             // detach any prior Subscription
    this.listener[collection] = {
      slice: slice,
      ready: ready,
      cnt: -1,                                        // '-1' is not-yet-snapped, '0' is first snapshot
      subscribe: this.fire.colRef(collection, query)
        .stateChanges()                               // watch for changes since last snapshot
        .subscribe(sync)
    }
    this.dbg('on: %s', collection);
    return ready.promise;                             // indicate when snap0 is complete
  }

  public status(collection: string) {
    const { slice, cnt, ready: { promise: ready } } = this.listener[collection];
    return { slice, cnt, ready };
  }

  /** detach an existing snapshot listener */
  public off(collection: string) {
    const listen = this.listener[collection];

    if (listen && isFunction(listen.subscribe.unsubscribe)) {
      listen.subscribe.unsubscribe();
      this.dbg('off: %s', collection);
    }
    delete this.listener[collection];
  }

  /** handler for snapshot listeners */
  private async sync(collection: string, snaps: DocumentChangeAction<IStoreDoc>[]) {
    const listen = this.listener[collection];
    let setStore: any, delStore: any, truncStore;

    this.listener[collection].cnt += 1;

    const [snapAdd, snapMod, snapDel] = snaps.reduce((cnts, snap) => {
      const idx = ['added', 'modified', 'removed'].indexOf(snap.type);
      cnts[idx] += 1;
      return cnts;
    }, [0, 0, 0]);
    this.dbg('sync: %s #%s detected from %s (add:%s, upd:%s, del:%s)',
      collection, listen.cnt, this.source(snaps), snapAdd, snapMod, snapDel);

    switch (listen.slice) {                           // TODO: can we merge these?
      case SLICE.client:
        setStore = SetClient;
        delStore = DelClient;
        truncStore = TruncClient;
        break;

      case SLICE.member:
        setStore = SetMember;
        delStore = DelMember;
        truncStore = TruncMember;
        break;

      case SLICE.attend:
        setStore = SetAttend;
        delStore = DelAttend;
        truncStore = TruncAttend;
        break;

      default:
        this.dbg('snap: Unexpected slice: %s', listen.slice);
        return;                                       // Unknown Slice !!
    }

    if (listen.cnt === 0) {                           // this is the initial snapshot, so check for tampering
      const localStore = this.localStore[listen.slice] || {};
      const localList: IStoreDoc[] = [];
      const snapList = snaps.map(snap => Object.assign({}, { [FIELD.id]: snap.payload.doc.id }, snap.payload.doc.data()));

      Object.keys(localStore).forEach(key => localList.push(...localStore[key]));
      let [localHash, storeHash] = await Promise.all([
        cryptoHash(localList.sort(sortKeys(FIELD.store, FIELD.id))),
        cryptoHash(snapList.sort(sortKeys(FIELD.store, FIELD.id))),
      ])

      if (listen.slice === SLICE.member) {
        this.dbg('local: %s, %j', localHash, localList.sort(sortKeys(FIELD.store, FIELD.id)));
        this.dbg('snap: %s, %j', storeHash, snapList.sort(sortKeys(FIELD.store, FIELD.id)));
      }

      listen.ready.resolve(true);                     // indicate snap0 is ready
      if (localHash === storeHash)                    // compare what is in snap0 with localStorage
        return;                                       // ok, already sync'd  

      this.store.dispatch(new truncStore());          // otherwise, reset Store
    }

    snaps.forEach(snap => {
      const data = Object.assign({}, { [FIELD.id]: snap.payload.doc.id }, snap.payload.doc.data());

      switch (snap.type) {
        case 'added':
        case 'modified':
          this.store.dispatch(new setStore(data));
          if (data.store === STORE.profile && data.type === 'claims' && !data[FIELD.expire])
            this.store.dispatch(new LoginToken());    // special: access-level has changed
          break;

        case 'removed':
          this.store.dispatch(new delStore(data));
          if (data.store === STORE.profile && data.type === 'plan' && !data[FIELD.expire])
            this.store.dispatch(new Navigate([ROUTE.plan])); // special: current-plan has been deleted
          break;
      }
    })
  }

  private source(snaps: DocumentChangeAction<IStoreDoc>[]) {
    const meta = snaps.length ? snaps[0].payload.doc.metadata : {} as SnapshotMetadata;
    return meta.fromCache
      ? 'cache'
      : meta.hasPendingWrites
        ? 'local'
        : 'server'
  }
}