import { Injectable } from '@angular/core';
import { DocumentChangeAction } from '@angular/fire/firestore';

import { Store } from '@ngxs/store';
import { ROUTE } from '@route/router/route.define';
import { NavigateService } from '@route/navigate.service';

import { buildDoc, checkStorage, getSource, addMeta, getMethod } from '@dbase/sync/sync.library';
import { IListen } from '@dbase/sync/sync.define';
import { AuthToken } from '@dbase/state/auth.action';
import { getSlice } from '@dbase/state/state.library';

import { FIELD, STORE } from '@dbase/data/data.define';
import { IStoreMeta } from '@dbase/data/data.schema';
import { DBaseModule } from '@dbase/dbase.module';
import { FireService } from '@dbase/fire/fire.service';
import { IQuery } from '@dbase/fire/fire.interface';

import { IObject } from '@lib/object.library';
import { isFunction } from '@lib/type.library';
import { createPromise } from '@lib/utility.library';
import { dbg } from '@lib/logger.library';

@Injectable({ providedIn: DBaseModule })
export class SyncService {
	private dbg = dbg(this);
	private listener: IObject<IListen> = {};

	constructor(private fire: FireService, private store: Store, private navigate: NavigateService) { this.dbg('new'); }

	/** establish a listener to a remote Firestore Collection, and sync to an NGXS Slice */
	public async on(collection: string, query?: IQuery) {
		const sync = this.sync.bind(this, collection);		// bind 'collection' to a sync Function
		const ready = createPromise<boolean>();

		this.off(collection);                             // detach any prior Subscription
		this.listener[collection] = {
			slice: collection,
			ready: ready,
			cnt: -1,                                        // '-1' is not-yet-snapped, '0' is first snapshot
			method: getMethod(collection),
			subscribe: this.fire.colRef<IStoreMeta>(collection, query)
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
	public off(collection: string, trunc?: boolean) {
		const listen = this.listener[collection];

		if (listen) {																			// are we listening?
			if (isFunction(listen.subscribe.unsubscribe)) {
				listen.subscribe.unsubscribe();
				this.dbg('off: %s', collection);
			}

			if (trunc)
				this.store.dispatch(new listen.method.truncStore());

			delete this.listener[collection];
		}
	}

	/** handler for snapshot listeners */
	// private async sync(collection: string, fire: FireService, snaps: DocumentChangeAction<IStoreMeta>[]) {
	private async sync(collection: string, snaps: DocumentChangeAction<IStoreMeta>[]) {
		const listen = this.listener[collection];
		const { setStore, delStore, truncStore } = listen.method;

		const source = getSource(snaps);
		const debug = source !== 'cache' && this.listener[collection].cnt !== -1;
		const [snapAdd, snapMod, snapDel] = snaps
			.reduce((cnts, snap) => {
				const idx = ['added', 'modified', 'removed'].indexOf(snap.type);
				cnts[idx] += 1;
				return cnts;
			}, [0, 0, 0]);

		this.listener[collection].cnt += 1;
		this.dbg('sync: %s #%s detected from %s (add:%s, mod:%s, rem:%s)',
			collection, listen.cnt, source, snapAdd, snapMod, snapDel);

		if (listen.cnt === 0) {                           // initial snapshot
			if (await checkStorage(listen, snaps))
				return;																				// storage already sync'd... skip the initial snapshot

			await this.store
				.dispatch(new truncStore(debug))							// suspected tampering, reset Store
				.toPromise();
		}

		snaps.forEach(async snap => {
			const data = snap.type === 'removed'
				? addMeta(snap)																// no need to fetch meta from server for 'removed' documents
				: await buildDoc(snap, this.fire);
			data[FIELD.store] = data[FIELD.store] || collection;

			switch (snap.type) {
				case 'added':
				case 'modified':
					this.store.dispatch(new setStore(data, debug));
					if (listen.cnt !== 0) {
						if (data[FIELD.store] === STORE.profile && data[FIELD.type] === 'claim' && !data[FIELD.expire])
							this.store.dispatch(new AuthToken());   // special: access-level has changed

						if (data[FIELD.store] === STORE.profile && data[FIELD.type] === 'plan' && !data[FIELD.expire])
							this.navigate.route(ROUTE.attend);			// special: initial Plan is set
					}
					break;

				case 'removed':
					this.store.dispatch(new delStore(data, debug));
					if (listen.cnt !== 0) {
						if (data[FIELD.store] === STORE.profile && data[FIELD.type] === 'plan' && !data[FIELD.expire])
							this.navigate.route(ROUTE.plan);				// special: Plan has been deleted
					}
					break;
			}
		})

		if (listen.cnt === 0)
			listen.ready.resolve(true);
	}
}