import { Injectable } from '@angular/core';
import { take } from 'rxjs/operators';
import { Store } from '@ngxs/store';
import { DocumentReference } from '@angular/fire/firestore';

import { SnackService } from '@service/material/snack.service';
import { COLLECTION, FIELD } from '@dbase/data/data.define';
import { TStoreBase, IMeta, ICustomClaims, IStoreMeta, FNumber, FType } from '@dbase/data/data.schema';
import { getWhere, updPrep, docPrep, checkDiscard } from '@dbase/data/data.library';

import { DBaseModule } from '@dbase/dbase.module';
import { getSlice } from '@dbase/state/state.library';
import { ISummary } from '@dbase/state/state.define';
import { StateService } from '@dbase/state/state.service';
import { TWhere, IQuery } from '@dbase/fire/fire.interface';
import { FireService } from '@dbase/fire/fire.service';
import { SyncService } from '@dbase/sync/sync.service';
import { AuthService } from '@service/auth/auth.service';
import { asAt } from '@dbase/library/app.library';

import { TString } from '@lib/type.library';
import { getStamp, TDate } from '@lib/date.library';
import { asArray } from '@lib/array.library';
import { dbg } from '@lib/logger.library';

/**
 * The DataService is a go-between for the local State (ngxs 'Store')
 * and the remote DataBase (Firebase 'Cloud Firestore').  
 * The intention is that all 'reads' are from State, and all 'writes' are to a persisted
 * local cache of the Database (which FireStore will sync back to the server).
 */
@Injectable({ providedIn: DBaseModule })
export class DataService {
	private dbg = dbg(this);

	constructor(public auth: AuthService, private fire: FireService, private sync: SyncService, private store: Store, private state: StateService, private snack: SnackService) {
		this.dbg('new');
		this.sync.on(COLLECTION.client)
			.then(res => this.dbg('init: %j', res));
	}

	/** Make Store data available in a Promise */
	private snap<T>(store: string) {
		const slice = getSlice(store);

		return this.store
			.selectOnce<T[]>(state => state[slice][store])
			.toPromise()
	}

	getCurrent<T>(store: string, where: TWhere = []) {
		return this.state.asPromise(this.state.getCurrent<T>(store, where));
	}

	getStore<T>(store: string, where: TWhere = [], date?: TDate) {
		return this.state.asPromise(this.state.getStore<T>(store, where, date));
	}

	getState<T>(store: string, where: TWhere = []) {
		return this.state.asPromise(this.state.getState<T>(store, where));
	}

	getMeta(store: string, docId: string) {
		return store
			? this.fire.callMeta(store, docId)										// get server to respond with document meta-data
			: Promise.reject(`Cannot determine slice: ${store}`)
	}

	writeClaim(claim: ICustomClaims) {
		return this.fire.writeClaim(claim);											// update some components on /admin/register/{pushId}/user/customClaims
	}

	createToken(uid: string) {
		return this.fire.createToken(uid);
	}

	getUID() {
		return this.auth.current
			.then(current => current!.uid);
	}

	getFire<T>(collection: string, query?: IQuery) {		// direct access to collection, rather than via state
		return this.fire.combine('snapshotChanges', this.fire.colRef<T>(collection, query))
			.pipe(take(1))																				// wait for first emit from each Observable in value-array
			.toPromise()
			.then(obs => obs.flat())															// flatten the array-of-values results
			.then(snap => snap.map(docs => ({ [FIELD.id]: docs.payload.doc.id, ...docs.payload.doc.data() })))
	}

	get newId() {
		return this.fire.newId();                       				// get Firebase to generate a new Key
	}

	async setDoc(store: string, doc: TStoreBase) {
		doc = docPrep(doc, await this.getUID())									// make sure we have a <key/uid> field
		return this.fire.setDoc(store, doc);
	}

	updDoc(store: string, docId: string, data: TStoreBase) {
		return this.fire.updDoc(store, docId, data);
	}

	/** Expire any current matching docs, and Create new doc */
	async insDoc(nextDocs: TStoreBase, filter?: TWhere, discards: TString = []) {
		const creates: TStoreBase[] = [];												// array of documents to Create
		const updates: TStoreBase[] = [];												// array of documents to Update
		const stamp = getStamp();																// the timestamp of the Insert
		const uid = await this.getUID();

		const promises = asArray(nextDocs).map(async nextDoc => {
			let tstamp = nextDoc[FIELD.effect] as FType<FNumber> || stamp;
			let where: TWhere;

			try {
				nextDoc = docPrep(nextDoc, uid);										// make sure we have a <key/uid>
				where = getWhere(nextDoc as IMeta, filter);
			} catch (error) {
				this.snack.open(error.message);                     // show the error to the User
				return;                                             // abort the Create/Update
			}

			const currDocs = await this.snap<TStoreBase>(nextDoc[FIELD.store])// read the store
				.then(table => asAt(table, where, tstamp))          // find where to create new doc (generally one-prevDoc expected)
				.then(table => updPrep(table, tstamp, this.fire))   // prepare the update's <effect>/<expire>

			if (currDocs.updates.length) {
				if (currDocs.stamp > 0)															// if the stamp is positive,
					nextDoc[FIELD.effect] = currDocs.stamp;           // updPrep has changed the <effect>,
				else nextDoc[FIELD.expire] = -currDocs.stamp;       // otherwise back-date the nextDoc's <expire>
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
	batch(creates: IStoreMeta[] = [], updates: IStoreMeta[] = [], deletes: IStoreMeta[] = [], event?: any, callBack?: (evt: any) => any) {
		const writes = creates.length + updates.length + deletes.length;
		const sync = (event && writes)													// an Event that this batch will fire
			? this.sync.wait(event, callBack)											// start a listener for 1st emit of Event
			: Promise.resolve()																		// else, no need to wait

		return this.getUID()
			.then(uid => {																				// ensure we have a <store>/<uid> in all Member-releated documents
				creates = creates.map(doc => docPrep(doc as TStoreBase, uid));
				updates = updates.map(doc => docPrep(doc as TStoreBase, uid));
				deletes = deletes.map(doc => docPrep(doc as TStoreBase, uid));
			})
			.then(_ => this.fire.batch(creates, updates, deletes))// batch the writes
			.then(_ => sync)																			// wait for callback to resolve
	}

	/** Wrap writes in a Transaction */
	runTxn(creates?: IStoreMeta[], updates?: IStoreMeta[], deletes?: IStoreMeta[], selects?: DocumentReference[]) {
		return this.fire.runTxn(creates, updates, deletes, selects);
	}
}