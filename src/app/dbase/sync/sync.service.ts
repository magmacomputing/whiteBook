import { Injectable } from '@angular/core';
import { combineLatest, merge, timer } from 'rxjs';
import { map, debounce, timeout, take, skip } from 'rxjs/operators';
import { Store, Actions, ofActionDispatched, ActionType } from '@ngxs/store';

import { sync } from '@dbase/sync/sync.define';
import { SLICE } from '@dbase/state/state.define';
import { AuthSlice } from '@dbase/state/auth.action';
import { checkStorage, getSource, getMethod } from '@dbase/sync/sync.library';

import type { FireDocument } from '@dbase/data.schema';
import { COLLECTION } from '@dbase/data.define';
import { DBaseModule } from '@dbase/dbase.module';
import { FireService } from '@dbase/fire/fire.service';
import { fire } from '@dbase/fire/fire.library';

import { Pledge } from '@library/utility.library';
import { getEnumValues, isEmpty, isFunction, isUndefined } from '@library/type.library';
import { isEqual, quoteObj } from '@library/object.library';
import { dbg } from '@library/logger.library';

/**
 * Establish a new SyncService per remote Cloud Firestore instance
 */
@Injectable({ providedIn: DBaseModule })
export class SyncService {
	#dbg = dbg(this);
	#listener: Map<sync.Key, sync.Listen> = new Map();

	constructor(private fire: FireService, private store: Store, private actions: Actions) { this.#dbg('new'); }

	/**
	 * Establish a listener to a remote Firestore Collection, and sync to an NGXS Slice.  
	 * Additional collections can be defined, and merged into the same stream
	 */
	public async on(collection: COLLECTION, query?: fire.Query, ...additional: [COLLECTION, fire.Query?][]) {
		const ready = new Pledge<boolean>();
		const key: sync.Key = { collection, query };

		const label = `${quoteObj(query) ?? '[all]'} ${additional.length ? additional.map(quoteObj) : ''}`;
		const sync = this.sync.bind(this, key);
		const uid = await this.getAuthUID();

		additional.splice(0, 0, [collection, query]);			// stack the intial listen-request
		const listeners = additional											// register a listener for each collection/query
			.map(([collection, query]) => this.fire.listen<FireDocument>(collection, query, true))
		const first = combineLatest(listeners)						// wait for all listeners to emit, and
			.pipe(map(arr => arr.flat()), take(1));					// only flatten the first array of results
		const second = listeners													// wait for each listener, but
			.map(listener => listener.pipe(skip(1)));				// from second emit onwards

		this.off(collection, query);											// detach any prior subscription of the same signature
		this.#listener.set(key, {
			key,																						// stash reference to the key
			label,																					// stash Listen references
			ready,
			uid,
			cnt: -1,																				// '-1' is not-yet-snapped, '0' is initial snapshot
			subscription: merge(first, ...second)
				.subscribe(sync),															// start listening
			method: getMethod(collection),
		})

		merge(first, ...second)														// kick-off the subscription
			.pipe(take(1))																	// and auto-complete
			.subscribe();																		// ignore emit
		this.#dbg('on: %s %s', key.collection, label);
		return ready.promise;                             // indicate when snap0 is complete
	}

	/** detach an existing snapshot listener */
	public off(collection?: COLLECTION, query?: fire.Query, trunc?: boolean) {
		for (const [key, listen] of this.#listener.entries()) {
			if ((collection ?? key.collection) === key.collection && isEqual(query ?? key.query, key.query)) {
				this.#dbg('off: %s %j', key.collection, key.query || {});

				listen.subscription?.unsubscribe();						// detach all listeners

				if (trunc)
					this.store.dispatch(new listen.method.clearStore());

				this.#listener.delete(key);
			}
		}
	}

	private getAuthUID() {															// Useful for matching sync-events to the Auth'd User
		return this.store
			.selectOnce<AuthSlice>(state => state[SLICE.auth])
			.pipe(map(auth => auth.user?.uid ?? null))			// if logged-in, return the UserId
			.toPromise()
	}

	public status(collection?: COLLECTION) {
		const result: sync.Status[] = [];

		for (const [key, listen] of this.#listener.entries())
			if (isUndefined(collection) || collection === key.collection)
				result.push({ collection: key.collection, query: key.query, promise: listen.ready.status })

		return result;
	}

	/**
	 * Wait for an NGXS-event to occur,  
	 * and optionally provide a callback function to process after the event
	 */
	public wait<T>(event: ActionType, callBack?: (payload: T) => Promise<any>) {			// TODO: replace <any> with correct Action Type
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
						this.#dbg('timeOut: %s', event.type);				// log the event not detected
					}
				)
		})
	}

	/** handler for snapshot listener */
	private async sync(key: sync.Key, snaps: fire.FireSnap<FireDocument>[]) {
		const source = getSource(snaps[0].metadata);
		const listen = this.#listener.get(key)!;
		const { setStore, delStore, clearStore } = listen.method;

		if (isEmpty(snaps))
			return listen.ready.resolve(false);							// bail-out

		const debug = source !== sync.SOURCE.Cache;
		const changes = getEnumValues(sync.CHANGE);
		const [snapAdd, snapMod, snapDel] = snaps
			.reduce((cnts, snap) => {
				const idx = changes.indexOf(snap.type as sync.CHANGE);

				cnts[idx].push(snap.doc);
				return cnts;
			}, [[] as FireDocument[], [] as FireDocument[], [] as FireDocument[]]);

		listen.cnt += 1;
		this.#dbg('sync: %s %s #%s (ins:%s, upd:%s, del:%s) %s',
			key.collection, source, listen.cnt, snapAdd.length, snapMod.length, snapDel.length, listen.label);

		if (listen.cnt === 0) {   												// initial snapshot from cache
			listen.uid = await this.getAuthUID();						// override with now-settled Auth UID
			if (await checkStorage(listen, snapAdd))				// check the cache against localStorage
				return listen.ready.resolve(true);						// storage already sync'd... skip the initial snapshot

			await this.store
				.dispatch(new clearStore(debug))							// suspected tampering, reset Store
				.toPromise();
		}

		await this.store.dispatch(new setStore(snapAdd, debug)).toPromise();	// do 'added' first
		await this.store.dispatch(new setStore(snapMod, debug)).toPromise();	// then 'modified'
		await this.store.dispatch(new delStore(snapDel, debug)).toPromise();	// then 'removed'

		if (listen.cnt !== 0)
			listen.ready.resolve(true);
	}
}