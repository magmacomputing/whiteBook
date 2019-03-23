import { Injectable } from '@angular/core';
import { map } from 'rxjs/operators';
import { DocumentChangeAction } from '@angular/fire/firestore';

import { Store } from '@ngxs/store';
import { ROUTE } from '@route/router/route.define';
import { NavigateService } from '@route/navigate.service';

import { checkStorage, getSource, addMeta, getMethod } from '@dbase/sync/sync.library';
import { IListen } from '@dbase/sync/sync.define';
import { SLICE } from '@dbase/state/state.define';
import { AuthToken, IAuthState } from '@dbase/state/auth.action';

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
	private uid: string | null = null;

	constructor(private fire: FireService, private store: Store, private navigate: NavigateService) { this.dbg('new'); }

	/** establish an array of listeners to a remote Firestore Collection, and sync to an NGXS Slice */
	public async on(collection: string, query?: IQuery) {
		const ready = createPromise<boolean>();
		this.getAuthUID();																// make sure we stash the Auth User's ID

		const refs = this.fire.colRef<IStoreMeta>(collection, query);
		const stream = this.fire.merge('stateChanges', refs);
		const sync = this.sync.bind(this, collection);

		this.off(collection);                             // detach any prior Subscription
		this.listener[collection] = {
			slice: collection,
			ready: ready,
			cnt: -1,																				// '-1' is not-yet-snapped, '0' is first snapshot
			method: getMethod(collection),
			subscribe: stream.subscribe(sync)
		}

		this.dbg('on: %s', collection);
		return ready.promise;                             // indicate when snap0 is complete
	}

	private getAuthUID() {															// Useful for matching sync-events to the Auth'd User
		if (!this.uid) {
			this.store
				.selectOnce<IAuthState>(state => state[SLICE.auth])
				.pipe(map(auth => auth.user && auth.user.uid))// if logged-in, return the UserId
				.toPromise()
				.then(uid => this.uid = uid)
		}
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
		}

		if (trunc)
			this.store.dispatch(new listen.method.truncStore());

		delete this.listener[collection];
	}

	/** handler for snapshot listeners */
	private async sync(collection: string, snaps: DocumentChangeAction<IStoreMeta>[]) {
		const listen = this.listener[collection];
		const { setStore, delStore, truncStore } = listen.method;

		const source = getSource(snaps);
		const debug = source !== 'cache' && listen.cnt !== -1;
		const [snapAdd, snapMod, snapDel] = snaps
			.reduce((cnts, snap) => {
				const idx = ['added', 'modified', 'removed'].indexOf(snap.type);
				cnts[idx] += 1;
				return cnts;
			}, [0, 0, 0]);

		listen.cnt += 1;
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
			const data = addMeta(snap);
			const check = listen.cnt !== 0 && data[FIELD.uid] === this.uid;

			switch (snap.type) {
				case 'added':
				case 'modified':
					this.store.dispatch(new setStore(data, debug));
					if (check) {
						if (data[FIELD.store] === STORE.profile && data[FIELD.type] === 'claim' && !data[FIELD.expire])
							this.store.dispatch(new AuthToken());   // special: access-level has changed

						if (data[FIELD.store] === STORE.profile && data[FIELD.type] === 'plan' && !data[FIELD.expire])
							this.navigate.route(ROUTE.attend);			// special: initial Plan is set
					}
					break;

				case 'removed':
					this.store.dispatch(new delStore(data, debug));
					if (check) {
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