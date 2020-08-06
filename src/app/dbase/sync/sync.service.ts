import { Injectable } from '@angular/core';
import { timer } from 'rxjs';
import { map, debounce, timeout, take } from 'rxjs/operators';

import { Store, Actions, ofActionDispatched } from '@ngxs/store';
import { DocumentChangeAction } from '@angular/fire/firestore';

import { ROUTE } from '@route/router/route.define';
import { NavigateService } from '@route/router/navigate.service';

import { checkStorage, getSource, addMeta, getMethod } from '@dbase/sync/sync.library';
import { IListenKey, IListen } from '@dbase/sync/sync.define';
import { SLICE } from '@dbase/state/state.define';
import { Event, IAuthState } from '@dbase/state/auth.action';

import { FIELD, STORE, COLLECTION } from '@dbase/data/data.define';
import { IStoreMeta } from '@dbase/data/data.schema';
import { DBaseModule } from '@dbase/dbase.module';
import { FireService } from '@dbase/fire/fire.service';
import { IQuery } from '@dbase/fire/fire.interface';

import { Pledge, TPledge } from '@library/utility.library';
import { isFunction, isUndefined } from '@library/type.library';
import { dbg } from '@library/logger.library';

/**
 * Establish a new SyncService per remote Cloud Firestore instance
 */
@Injectable({ providedIn: DBaseModule })
export class SyncService {
	private dbg = dbg(this);
	private listener: Map<IListenKey, IListen> = new Map();

	constructor(private fire: FireService, private store: Store, private navigate: NavigateService, private actions: Actions) { this.dbg('new'); }

	/**
	 * Establish a listener to a remote Firestore Collection, and sync to an NGXS Slice.  
	 * Additional collections can be defined, and merged into the same slice
	 */
	public async on(collection: COLLECTION, query?: IQuery, ...additional: [COLLECTION, IQuery?][]) {
		const ready = new Pledge<boolean>();
		const refs = this.fire.colRef<IStoreMeta>(collection, query);
		const key: IListenKey = { collection, query };

		additional.forEach(([collection, query]) => 			// in case we want to append other Collection queries
			refs.push(...this.fire.colRef<IStoreMeta>(collection, query)));
		const stream = this.fire.merge('stateChanges', refs);
		const sync = this.sync.bind(this, key);

		this.off(collection, query);											// detach any prior Subscription of the same signature
		this.listener.set(key, {
			key,																						// save a reference to the key
			ready,
			cnt: -1,																				// '-1' is not-yet-snapped, '0' is initial snapshot
			uid: await this.getAuthUID(),
			method: getMethod(collection),
			subscribe: stream.subscribe(sync)
		});

		this.dbg('on: %s %j', collection, query || {});
		return ready.promise;                             // indicate when snap0 is complete
	}

	private getAuthUID() {															// Useful for matching sync-events to the Auth'd User
		return this.store
			.selectOnce<IAuthState>(state => state[SLICE.auth])
			.pipe(map(auth => auth.user && auth.user.uid))	// if logged-in, return the UserId
			.toPromise()
	}

	public status(collection?: COLLECTION) {
		const result: Partial<{ collection: string, query: IQuery, promise: TPledge }>[] = [];

		for (const [key, listen] of this.listener.entries())
			if (isUndefined(collection) || collection === key.collection)
				result.push({ collection: key.collection, query: key.query, promise: listen.ready.status })

		return result;
	}

	/**
	 * Wait for an NGXS-event to occur,  
	 * and optionally provide a callback function to process after the event
	 */
	public wait<T>(event: any, callBack?: (payload: T) => Promise<any>) {			// TODO: replace <any> with correct Action Type
		const timeOut = 10_000;															// wait up-to 10 seconds

		return new Promise<T>((resolve, reject) => {
			this.actions.pipe(
				ofActionDispatched(event), 											// listen for an NGXS event
				debounce(_ => timer(500)), 											// let State settle
				take(1), 																				// unsubscribe after first occurence
				timeout(timeOut)																// but wait on max <timeOut> ms
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
	public off(collection?: COLLECTION, query?: IQuery, trunc?: boolean) {
		for (const [key, listen] of this.listener.entries()) {
			if ((collection ?? key.collection) === key.collection
				&& JSON.stringify((query ?? key.query)) === JSON.stringify(key.query)) {
				this.dbg('off: %s %j', key.collection, key.query || {});

				listen.subscribe.unsubscribe();
				if (trunc)
					this.store.dispatch(new listen.method.truncStore());

				this.listener.delete(key);
			}
		}
	}

	/** handler for snapshot listeners */
	private async sync(key: IListenKey, snaps: DocumentChangeAction<IStoreMeta>[]) {
		const listen = this.listener.get(key)!;
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
		this.dbg('sync: %s %j #%s detected from %s (ins:%s, upd:%s, del:%s)',
			key.collection, key.query || {}, listen.cnt, source, snapAdd.length, snapMod.length, snapDel.length);

		if (listen.cnt === 0 && key.collection !== COLLECTION.admin) {               // initial snapshot, but Admin will arrive in multiple snapshots
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
			snaps.forEach(async snap => {										// look for special actions to emit
				const data = addMeta(snap);
				if (data[FIELD.uid] === listen.uid) {					// but only for authenticated User
					switch (snap.type) {
						case 'added':
						case 'modified':
							if (data[FIELD.store] === STORE.profile && data[FIELD.type] === 'claim' && !data[FIELD.expire])
								this.store.dispatch(new Event.Token()); // special: access-level has changed

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