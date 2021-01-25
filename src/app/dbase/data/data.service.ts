import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { take } from 'rxjs/operators';
import { Store } from '@ngxs/store';

import { DBaseModule } from '@dbase/dbase.module';
import { COLLECTION, STORE, FIELD, PROFILE } from '@dbase/data.define';
import { getWhere, updPrep, docPrep, checkDiscard } from '@dbase/data/data.library';
import type { FireDocument, Profile } from '@dbase/data.schema';

import { AuthService } from '@service/auth/auth.service';
import { SyncService } from '@dbase/sync/sync.service';
import { StateService } from '@dbase/state/state.service';
import { SnackService } from '@service/material/snack.service';
import { FireService } from '@dbase/fire/fire.service';

import { fire } from '@dbase/fire/fire.library';
import { getSlice } from '@dbase/state/state.library';

import type { TString } from '@library/type.library';
import { getStamp, Instant } from '@library/instant.library';
import { asArray } from '@library/array.library';
import { asAt } from '@library/app.library';
import { dbg } from '@library/logger.library';

/**
 * The DataService is a go-between for the local State (ngxs 'Store')
 * 	and the remote Database (Firebase 'Cloud Firestore').  
 * The intention is that it will funnel all 'reads' from State, and all 'writes' to a persisted,
 * 	local cache of the Database (which FireStore will sync back to the server).
 */
@Injectable({ providedIn: DBaseModule })
export class DataService {
	#dbg = dbg(this);

	constructor(public auth: AuthService, private fire: FireService, private sync: SyncService, private store: Store, private state: StateService, private snack: SnackService) {
		this.#dbg('new');
		this.sync.on(COLLECTION.Client)
			.then(res => this.#dbg('init: %j', res));
	}

	/** Make Store data available in a Promise */
	private snap<T>(store: STORE, query?: fire.Query) {
		const slice = getSlice(store);

		if (query)
			return this.select<T>(slice, query);

		return this.store
			.selectOnce<T[]>(state => state[slice][store])
			.toPromise()
	}

	getCurrent<T>(store: STORE, where: fire.Query["where"] = [], isHidden = false) {
		return this.state.asPromise(this.state.getCurrent<T>(store, where, isHidden));
	}

	getStore<T>(store: STORE, where: fire.Query["where"] = [], date?: Instant.TYPE) {
		return this.state.asPromise(this.state.getStore<T>(store, where, date));
	}

	getState<T>(store: STORE, where: fire.Query["where"] = []) {
		return this.state.asPromise(this.state.getState<T>(store, where));
	}

	getMeta(store: STORE, docId: string) {
		return this.fire.callMeta(store, docId)									// get server to respond with document meta-data
	}

	createToken(uid: string) {
		return this.fire.createToken(uid);
	}

	authToken(token: string, user: firebase.default.UserInfo) {
		return this.fire.authToken(token, user);
	}

	getCurrentUser() {
		return this.auth.current
			.then(current => current?.uid);												// get the impersonate UserID
	}

	getActiveUser() {
		return this.auth.user
			.then(state => state.auth.user?.uid);									// get the signIn UserID
	}

	getClaim$() {																							// CustomClaims object
		return this.auth.claim$;
	}

	getRoles$() {																							// ROLE[]
		return this.auth.roles$
	}

	isAdmin$() {
		return this.auth.isAdmin$;
	}

	async getProfileUser() {																	// get the signIn User's Profile
		const uid = await this.getActiveUser();
		const profile = await this.getCurrent<Profile>(STORE.Profile, fire.addWhere(FIELD.Uid, uid));

		return profile.reduce((acc, itm) => {
			const type = itm[FIELD.Type];
			const doc = itm as FireDocument;
			acc[type] = doc[type];
			return acc;
		}, {} as Record<PROFILE, any>)
	}

	select<T>(collection: COLLECTION, query?: fire.Query) {	// direct access to collection, rather than via state
		return this.fire.select<T>(collection, query);
	}

	listen<T>(collection: COLLECTION, query?: fire.Query) {	// observable access to collection
		return this.fire.listen<T>(collection, query);
	}

	asPromise<T>(obs: Observable<T[]>) {
		return obs
			.pipe(take(1))
			.toPromise()
	}

	newId(store: COLLECTION | STORE) {
		return this.fire.newId(store);              				// get Firebase to generate a new Key
	}

	async setDoc(doc: FireDocument) {
		const set = docPrep(doc, await this.getCurrentUser())// make sure we have a <key/uid> field
		return this.fire.insert(set);
	}

	updDoc(data: FireDocument) {
		return this.fire.update(data);
	}

	/** Expire any current matching docs, and Create new doc */
	async insDoc(nextDocs: FireDocument, filter?: fire.Query["where"], discards: TString = []) {
		const creates: FireDocument[] = [];											// array of documents to Create
		const updates: FireDocument[] = [];											// array of documents to Update
		const stamp = getStamp();																// the timestamp of the Insert
		const uid = await this.getCurrentUser();

		const promises = asArray(nextDocs).map(async nextDoc => {
			let tstamp = nextDoc[FIELD.Effect] || stamp;
			let where: fire.Query["where"];
			const collection = getSlice(nextDoc[FIELD.Store]);

			try {
				nextDoc = docPrep(nextDoc, uid);										// make sure we have a <key/uid>
				where = getWhere(nextDoc, filter);
			} catch (error) {
				this.snack.open(error.message);                     // show the error to the User
				return;                                             // abort the Create/Update
			}

			const currDocs = await this.select<FireDocument>(collection, { where })
				.then(table => asAt(table, where, tstamp))          // find where to create new doc (generally one-prevDoc expected)
				.then(table => updPrep(table, tstamp, this.fire))   // prepare the update's <effect>/<expire>

			if (currDocs.updates.length) {
				if (currDocs.stamp > 0)															// if the stamp is positive,
					nextDoc[FIELD.Effect] = currDocs.stamp;           // updPrep has changed the <effect>,
				else nextDoc[FIELD.Expire] = -currDocs.stamp;       // otherwise back-date the nextDoc's <expire>
			}

			if (!checkDiscard(discards, nextDoc, currDocs.data)) {// only if all currDocs are different from nextDoc...
				creates.push(nextDoc);                              // push the prepared document-create
				updates.push(...currDocs.updates);                  // push the associated document-updates
			}
		})

		await Promise.all(promises);                            // collect all the Creates/Updates/Deletes
		return this.batch(creates, updates);                    // then apply writes in a Batch
	}

	/** Wrap writes in a Batch */
	batch(creates: FireDocument[] = [], updates: FireDocument[] = [], deletes: FireDocument[] = [], event?: any, callBack?: (evt: any) => any) {
		const writes = creates.length + updates.length + deletes.length;
		const sync = (event && writes)													// an Event that this batch will fire
			? this.sync.wait(event, callBack)											// start a listener for 1st emit of Event
			: Promise.resolve()																		// else, no need to wait

		return this.getCurrentUser()
			.then(uid => {																				// ensure we have a <store>/<uid> in all Member-releated documents
				creates = creates.map(doc => docPrep(doc, uid));
				updates = updates.map(doc => docPrep(doc, uid));
				deletes = deletes.map(doc => docPrep(doc, uid));
			})
			.then(_ => this.fire.batch(creates, updates, deletes))// batch the writes
			.then(_ => sync)																			// wait for callback to resolve
			.catch(err => { this.#dbg('err: %s', err.message); throw new Error(err) })
	}

	/** Wrap writes in a Transaction */
	transact(creates?: FireDocument[], updates?: FireDocument[], deletes?: FireDocument[], selects?: firebase.default.firestore.DocumentReference[]) {
		return this.fire.transact(creates, updates, deletes, selects);
	}

	connect(onOff: boolean) {
		this.#dbg('server: %s', onOff ? 'online' : 'offline');
		return this.fire.connect(onOff);
	}
}