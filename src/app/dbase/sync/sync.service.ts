import { Injectable } from '@angular/core';
import { timer } from 'rxjs';
import { map, debounce, timeout, take } from 'rxjs/operators';
import { Store, Actions, ofActionDispatched, ActionType } from '@ngxs/store';

import { sync } from '@dbase/sync/sync.define';
import { SLICE } from '@dbase/state/state.define';
import { AuthSlice } from '@dbase/state/auth.action';
import { checkStorage, getSource, addMeta, getMethod } from '@dbase/sync/sync.library';

import type { FireDocument } from '@dbase/data.schema';
import { COLLECTION } from '@dbase/data.define';
import { DBaseModule } from '@dbase/dbase.module';
import { FireService } from '@dbase/fire/fire.service';
import { fire } from '@dbase/fire/fire.library';

import { Pledge } from '@library/utility.library';
import { getEnumValues, isFunction, isUndefined } from '@library/type.library';
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
		const off: (() => void)[] = [];										// array of listener unsubscribe functions

		const label = `${quoteObj(query) ?? '[all]'} ${additional.length ? additional.map(quoteObj) : ''}`;
		const sync = this.sync.bind(this, key);
		const uid = await this.getAuthUID();

		this.off(collection, query);											// detach any prior subscription of the same signature
		off.push(this.fire.on(collection, query, sync));	// start primary collection listener
		additional.forEach(([collection, query]) => 			// in case we want to append other Collection queries
			off.push(this.fire.on(collection, query, sync)))

		this.#listener.set(key, {
			key,																						// stash reference to the key
			label,																					// stash Listen references
			streams: off.length,
			ready,
			cnt: -1,																				// '-1' is not-yet-snapped, '0' is initial snapshot
			uid,
			off,
			method: getMethod(collection),
		})

		this.#dbg('on: %s %s', key.collection, label);
		return ready.promise;                             // indicate when snap0 is complete
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

	/** detach an existing snapshot listener */
	public off(collection?: COLLECTION, query?: fire.Query, trunc?: boolean) {
		for (const [key, listen] of this.#listener.entries()) {
			if ((collection ?? key.collection) === key.collection && isEqual(query ?? key.query, key.query)) {
				this.#dbg('off: %s %j', key.collection, key.query || {});

				listen.off
					.forEach(off => off());												// detach all listeners

				if (trunc)
					this.store.dispatch(new listen.method.clearStore());

				this.#listener.delete(key);
			}
		}
	}

	/** handler for snapshot listener */
	private async sync(key: sync.Key, snaps: firebase.default.firestore.QuerySnapshot<FireDocument>) {
		const listen = this.#listener.get(key)!;
		const { setStore, delStore, clearStore } = listen.method;
		const source = getSource(snaps);

		if (snaps.empty)
			return listen.ready.resolve(false);							// bail-out

		listen.cnt += 1;
		const debug = source === sync.SOURCE.Server && listen.cnt >= listen.streams;
		const changes = getEnumValues(sync.CHANGE);
		const [snapAdd, snapMod, snapDel] = snaps.docChanges()
			.reduce((cnts, snap) => {
				const idx = changes.indexOf(snap.type as sync.CHANGE);

				cnts[idx].push(addMeta(snap.doc));
				return cnts;
			}, [[] as FireDocument[], [] as FireDocument[], [] as FireDocument[]]);

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

		if (listen.cnt === 0) {
			// 	snapAdd.concat(snapMod).forEach(doc => {				// special processing logic
			// 		if (doc[FIELD.Uid] === listen.uid) {					// but only docs for the currently authenticated User

			// 			if (doc[FIELD.Store] === STORE.Profile && doc[FIELD.Type] === PROFILE.Claim && !doc[FIELD.Expire])
			// 				this.store.dispatch(new LoginEvent.Token());// access-level has changed
			// 		}
			// 	})
		}
		else listen.ready.resolve(true);

		return listen.ready.promise;
	}
}