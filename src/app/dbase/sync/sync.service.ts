import { Injectable } from '@angular/core';
import type { DocumentChangeAction } from '@angular/fire/firestore';

import { timer } from 'rxjs';
import { map, debounce, timeout, take } from 'rxjs/operators';
import { Store, Actions, ofActionDispatched, ActionType } from '@ngxs/store';

import { sync } from '@dbase/sync/sync.define';
import { SLICE } from '@dbase/state/state.define';
import { LoginEvent, AuthSlice } from '@dbase/state/auth.action';
import { checkStorage, getSource, addMeta, getMethod } from '@dbase/sync/sync.library';
import { NavigateService } from '@route/router/navigate.service';

import type { FireDocument } from '@dbase/data.schema';
import { FIELD, STORE, COLLECTION, PROFILE } from '@dbase/data.define';
import { DBaseModule } from '@dbase/dbase.module';
import { FireService } from '@dbase/fire/fire.service';
import { fire } from '@dbase/fire/fire.library';

import { Pledge } from '@library/utility.library';
import { getEnumKeys, isFunction, isUndefined } from '@library/type.library';
import { quoteObj } from '@library/object.library';
import { dbg } from '@library/logger.library';

/**
 * Establish a new SyncService per remote Cloud Firestore instance
 */
@Injectable({ providedIn: DBaseModule })
export class SyncService {
	#dbg = dbg(this);
	#listener: Map<sync.Key, sync.Listen> = new Map();

	constructor(private fire: FireService, private store: Store, private navigate: NavigateService, private actions: Actions) { this.#dbg('new'); }

	/**
	 * Establish a listener to a remote Firestore Collection, and sync to an NGXS Slice.  
	 * Additional collections can be defined, and merged into the same stream
	 */
	public async on(collection: COLLECTION, query?: fire.Query, ...additional: [COLLECTION, fire.Query?][]) {
		const ready = new Pledge<boolean>();
		const refs = this.fire.colRef<FireDocument>(collection, query);
		const key: sync.Key = { collection, query };

		additional.forEach(([collection, query]) => 			// in case we want to append other Collection queries
			refs.push(...this.fire.colRef<FireDocument>(collection, query)));
		const stream = this.fire.merge(refs, 'stateChanges');
		const sync = this.sync.bind(this, key);
		const label = `${quoteObj(query) ?? '[all]'} ${additional.length ? additional.map(quoteObj) : ''}`;

		this.off(collection, query);											// detach any prior Subscription of the same signature
		this.#listener.set(key, {
			key,																						// stash reference to the key
			label,																					// stash Listen references			
			streams: refs.length,														// number of listeners
			ready,
			cnt: -1,																				// '-1' is not-yet-snapped, '0' is initial snapshot
			uid: await this.getAuthUID(),
			method: getMethod(collection),
			subscribe: stream.subscribe(sync)
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
			if ((collection ?? key.collection) === key.collection
				&& JSON.stringify((query ?? key.query)) === JSON.stringify(key.query)) {
				this.#dbg('off: %s %j', key.collection, key.query || {});

				listen.subscribe.unsubscribe();
				if (trunc)
					this.store.dispatch(new listen.method.clearStore());

				this.#listener.delete(key);
			}
		}
	}

	/** handler for snapshot listeners */
	private async sync(key: sync.Key, snaps: DocumentChangeAction<FireDocument>[]) {
		const listen = this.#listener.get(key)!;
		const { setStore, delStore, clearStore } = listen.method;
		const source = getSource(snaps);

		listen.cnt += 1;
		const debug = source === sync.SOURCE.Server && listen.cnt >= (listen.streams * 2);
		const [snapAdd, snapMod, snapDel] = snaps
			.reduce((cnts, snap) => {
				const idx = getEnumKeys(sync.CHANGE).indexOf(snap.type);

				cnts[idx].push(addMeta(snap));
				return cnts;
			}, [[] as FireDocument[], [] as FireDocument[], [] as FireDocument[]]);

		this.#dbg('sync: %s %s #%s (ins:%s, upd:%s, del:%s) %s',
			key.collection, source, listen.cnt, snapAdd.length, snapMod.length, snapDel.length, listen.label);

		if (listen.cnt === 0 && listen.streams === 1) {   // initial snapshot, but Admin will arrive in multiple streams
			listen.uid = await this.getAuthUID();						// override with now-settled Auth UID
			if (await checkStorage(listen, snaps)) {
				listen.ready.resolve(true);										// storage already sync'd... skip the initial snapshot
				return true;
			}
			await this.store
				.dispatch(new clearStore(debug))							// suspected tampering, reset Store
				.toPromise();
		}

		await this.store.dispatch(new setStore(snapAdd, debug)).toPromise();	// do 'added' first
		await this.store.dispatch(new setStore(snapMod, debug)).toPromise();	// then 'modified'
		await this.store.dispatch(new delStore(snapDel, debug)).toPromise();	// then 'removed'

		if (listen.cnt !== 0) {
			snaps.forEach(async snap => {										// look for special actions to emit
				const data = addMeta(snap);
				if (data[FIELD.Uid] === listen.uid) {					// but only for authenticated User
					switch (snap.type) {
						case sync.CHANGE.Added:
						case sync.CHANGE.Modified:
							if (data[FIELD.Store] === STORE.Profile && data[FIELD.Type] === PROFILE.Claim && !data[FIELD.Expire])
								this.store.dispatch(new LoginEvent.Token()); // special: access-level has changed
							break;

						case sync.CHANGE.Removed:
							break;
					}
				}
			})
		}

		if (listen.cnt === 0)
			listen.ready.resolve(true);
	}
}