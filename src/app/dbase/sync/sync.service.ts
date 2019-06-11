import { Injectable } from '@angular/core';
import { timer } from 'rxjs';
import { map, debounce, timeout, take } from 'rxjs/operators';

import { Store, Actions, ofActionDispatched } from '@ngxs/store';
import { DocumentChangeAction } from '@angular/fire/firestore';

import { ROUTE } from '@route/router/route.define';
import { NavigateService } from '@route/navigate.service';

import { checkStorage, getSource, addMeta, getMethod } from '@dbase/sync/sync.library';
import { IListen } from '@dbase/sync/sync.define';
import { SLICE } from '@dbase/state/state.define';
import { AuthToken, IAuthState } from '@dbase/state/auth.action';

import { FIELD, STORE, COLLECTION } from '@dbase/data/data.define';
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

	constructor(private fire: FireService, private store: Store, private navigate: NavigateService, private actions: Actions) { this.dbg('new'); }

	/**
	 * establish a listener to a remote Firestore Collection, and sync to an NGXS Slice.  
	 * Additional collections can be defined, and merged into the same slice
	 */
	public async on(collection: COLLECTION, query?: IQuery, ...additional: [COLLECTION, IQuery?][]) {
		const ready = createPromise<boolean>();
		const refs = this.fire.colRef<IStoreMeta>(collection, query);

		additional.forEach(([collection, query]) => 			// in case we want to append other Collection queries
			refs.push(...this.fire.colRef<IStoreMeta>(collection, query)));
		const stream = this.fire.merge('stateChanges', refs);
		const sync = this.sync.bind(this, collection);

		this.off(collection);                             // detach any prior Subscription
		this.listener[collection] = {
			collection,
			ready,
			uid: await this.getAuthUID(),
			cnt: -1,																				// '-1' is not-yet-snapped, '0' is first snapshot
			method: getMethod(collection),
			subscribe: stream.subscribe(sync)
		}

		this.dbg('on: %s' + (query ? ', %j' : ''), collection, query || '');
		return ready.promise;                             // indicate when snap0 is complete
	}

	private getAuthUID() {															// Useful for matching sync-events to the Auth'd User
		return this.store
			.selectOnce<IAuthState>(state => state[SLICE.auth])
			.pipe(map(auth => auth.user && auth.user.uid))	// if logged-in, return the UserId
			.toPromise()
	}

	public status(collection: COLLECTION) {
		const { cnt, ready: { promise: ready } } = this.listener[collection];
		return { collection, cnt, ready };
	}

	/**
	 * Wait for an NGXS-event to occur,  
	 * and optionally provide a callback function to process after the event
	 */
	public wait<T>(event: any, callBack?: (payload: T) => Promise<any>) {			// TODO: replace <any> with correct Action Type
		const timeOut = 10000;															// wait up-to 10 seconds

		return new Promise<T>((resolve, reject) => {
			this.actions.pipe(
				ofActionDispatched(event), 											// listen for an NGXS event
				debounce(_ => timer(500)), 											// let State settle
				take(1), 																				// unsubscribe after first occurence
				timeout(timeOut)
			)
				.subscribe(
					payload => {
						isFunction(callBack)
							? callBack(payload).then(resolve)
							: resolve(payload)
					},
					err => {
						reject(err);
						this.dbg('timeOut: %s', event.name);				// log the event not detected
					}
				)
		})
	}

	/** detach an existing snapshot listener */
	public off(collection: COLLECTION, trunc?: boolean) {
		const listen = this.listener[collection];

		if (listen) {																			// are we listening?
			if (isFunction(listen.subscribe.unsubscribe)) {
				listen.subscribe.unsubscribe();
				this.dbg('off: %s', collection);
			}

			if (trunc && listen.method)
				this.store.dispatch(new listen.method.truncStore());
		}

		delete this.listener[collection];
	}

	/** handler for snapshot listeners */
	private async sync(collection: COLLECTION, snaps: DocumentChangeAction<IStoreMeta>[]) {
		const listen = this.listener[collection];
		const { setStore, delStore, truncStore } = listen.method;

		const source = getSource(snaps);
		const debug = source !== 'cache' && source !== 'local' && listen.cnt !== -1;
		const [snapAdd, snapMod, snapDel] = snaps
			.reduce((cnts, snap) => {
				const idx = ['added', 'modified', 'removed'].indexOf(snap.type);
				cnts[idx].push(addMeta(snap))
				return cnts;
			}, [[] as IStoreMeta[], [] as IStoreMeta[], [] as IStoreMeta[]]);

		listen.cnt += 1;
		this.dbg('sync: %s #%s detected from %s (add:%s, upd:%s, del:%s)',
			collection, listen.cnt, source, snapAdd.length, snapMod.length, snapDel.length);

		if (listen.cnt === 0) {                           // initial snapshot
			listen.uid = await this.getAuthUID();						// override with now-settled Auth UID
			if (await checkStorage(listen, snaps))
				return listen.ready.resolve(true);						// storage already sync'd... skip the initial snapshot

			await this.store
				.dispatch(new truncStore(debug))							// suspected tampering, reset Store
				.toPromise();
		}

		await this.store.dispatch(new setStore(snapAdd, debug)).toPromise();	// do 'additions' first
		await this.store.dispatch(new setStore(snapMod, debug)).toPromise();	// then 'changes'
		await this.store.dispatch(new delStore(snapDel, debug)).toPromise();	// then 'deletes'

		if (listen.cnt !== 0) {
			snaps.forEach(async snap => {										// look for special actions to fire
				const data = addMeta(snap);
				if (data[FIELD.uid] === listen.uid) {					// but only for authenticated User
					switch (snap.type) {
						case 'added':
						case 'modified':
							if (data[FIELD.store] === STORE.profile && data[FIELD.type] === 'claim' && !data[FIELD.expire])
								this.store.dispatch(new AuthToken());   // special: access-level has changed

							if (data[FIELD.store] === STORE.profile && data[FIELD.type] === 'plan' && !data[FIELD.expire])
								this.navigate.route(ROUTE.attend);			// special: initial Plan is set
							break;

						case 'removed':
							if (data[FIELD.store] === STORE.profile && data[FIELD.type] === 'plan' && !data[FIELD.expire])
								this.navigate.route(ROUTE.plan);				// special: Plan has been deleted
							break;
					}
				}
			})
		}

		if (listen.cnt === 0)
			listen.ready.resolve(true);
	}
}