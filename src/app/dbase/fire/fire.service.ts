import { Injectable, NgZone } from '@angular/core';
import { firestore } from 'firebase/app';
import { merge, concat, Observable, combineLatest, defer } from 'rxjs';
import { tap, take, map } from 'rxjs/operators';

import { AngularFirestore, DocumentReference, AngularFirestoreCollection, DocumentChangeAction } from '@angular/fire/firestore';
import { AngularFireFunctions } from '@angular/fire/functions';
import { IUserInfo } from '@service/auth/auth.interface';
import { SnackService } from '@service/material/snack.service';

import { DBaseModule } from '@dbase/dbase.module';
import { FIELD, COLLECTION, STORE } from '@dbase/data/data.define';
import { IQuery, IDocMeta } from '@dbase/fire/fire.interface';
import { IStoreMeta } from '@dbase/data/data.schema';
import { getSlice } from '@dbase/state/state.library';
import { fnQuery } from '@dbase/fire/fire.library';

import { isUndefined } from '@library/type.library';
import { asArray } from '@library/array.library';
import { cloneObj } from '@library/object.library';
import { dbg } from '@library/logger.library';

type TChanges = 'stateChanges' | 'snapshotChanges' | 'auditTrail' | 'valueChanges';

/**
 * This private service will communicate with the FireStore database,
 * and is intended to be invoked via the DataService only
 */
@Injectable({ providedIn: DBaseModule })
export class FireService {
	private dbg = dbg(this);

	constructor(private readonly afs: AngularFirestore, private readonly aff: AngularFireFunctions,
		private zone: NgZone, private snack: SnackService) {
		this.dbg('new');
	}

	/**
	 * return Collection References (limited by an optional query).  
	 * If a 'logical-or' is detected in the 'value' of any query's Where-clause, multiple Collection References are returned.
	 */
	colRef<T>(collection: COLLECTION, query?: IQuery) {
		return isUndefined(query)
			? [this.afs.collection<T>(collection)]		// reference against the entire collection
			: fnQuery(query)													// else register an array of Querys over a collection reference
				.map(qry => this.afs.collection<T>(collection, qry));
	}

	private subRef<T, U extends TChanges>(colRefs: AngularFirestoreCollection<T>[], type: U) {
		return colRefs.map(colRef => colRef[type]()) as Observable<U extends 'valueChanges' ? T[] : DocumentChangeAction<T>[]>[];
	}

	merge<T, U extends TChanges>(type: U, colRefs: AngularFirestoreCollection<T>[]) {
		return merge(...this.subRef(colRefs, type));
	}

	combine<T, U extends TChanges>(type: U, colRefs: AngularFirestoreCollection<T>[]) {
		return combineLatest(...this.subRef(colRefs, type));
	}

	concat<T, U extends TChanges>(type: U, colRefs: AngularFirestoreCollection<T>[]) {
		return concat(...this.subRef(colRefs, type));
	}

	listen<T>(collection: COLLECTION, query?: IQuery, changes: TChanges = 'stateChanges') {
		return this.combine(changes, this.colRef<T>(collection, query))
			.pipe(
				map(obs => obs.flat()),									// flatten the array-of-values results
				map(snap => snap.map(docs => ({ [FIELD.id]: docs.payload.doc.id, ...docs.payload.doc.data() } as T)))
			)
	}

	get<T>(collection: COLLECTION, query?: IQuery) {
		return this.afs
			.collection(collection, fnQuery(query)[0])
			.get({ source: 'server' })								// get the server-data, rather than cache
			.toPromise()
			.then(snap => snap.docs.map(doc => ({ [FIELD.id]: doc.id, ...doc.data() as T })))
	}	

	/** Document Reference, for existing or new */
	docRef(store: STORE, docId?: string) {
		const col = store.includes('/')
			? store																		// already a '/{collection}' path
			: getSlice(store)													// lookup parent collection name for a 'store'

		docId = isUndefined(docId) ? this.newId() : docId;	// use supplied Id, else generate a new Id

		return this.afs.firestore.collection(col).doc(docId);
	}

	/** manage connectivity */
	connect(onOff: boolean) {
		return onOff
			? this.afs.firestore.enableNetwork()			// disconnect Cloud Firestore
			: this.afs.firestore.disableNetwork()			// reconnect Cloud Firestore
	}

	/** allocate a new meta-field _id */
	newId() {
		return this.afs.createId();
	}

	/** Remove the meta-fields, undefined fields, low-values fields from a document */
	private removeMeta(doc: firestore.DocumentData, opts: Record<string, boolean> = {}) {
		const { [FIELD.id]: a, [FIELD.create]: b, [FIELD.update]: c, [FIELD.access]: d, ...rest } = doc;

		Object.entries(rest).forEach(([key, value]) => {
			if (isUndefined(value)) {
				if (opts.setUndefined)
					delete rest[key]										// remove the field if 'set'
				else rest[key] = firestore.FieldValue.delete(); // delete the target field if 'update'

				// if (isObject(rest[key]) && JSON.stringify(rest[key]) === JSON.stringify({ "_methodName": "FieldValue.delete" }))
				// 	rest[key] = firestore.FieldValue.delete();	// TODO: workaround
			}
		})

		return rest;
	}

	/**
	 * Wrap database-writes within a set of Batches (limited to 300 documents per).  
	 * These documents are assumed to have a FIELD.store and (except for 'creates') a FIELD.id  
	 * If they are Member documents and missing a <uid> field, the current User is inserted  
	 * Perform all creates first, then all updates, finally all deletes
	 */
	batch(creates: IStoreMeta[] = [], updates: IStoreMeta[] = [], deletes: IStoreMeta[] = []) {
		const cloneCreate = [...asArray(creates)];
		const cloneUpdate = [...asArray(updates)];
		const cloneDelete = [...asArray(deletes)];
		const limit = 300;
		const commits: Promise<void>[] = [];

		while (cloneCreate.length + cloneUpdate.length + cloneDelete.length) {
			const c = cloneCreate.splice(0, limit);
			const u = cloneUpdate.splice(0, limit - c.length);
			const d = cloneDelete.splice(0, limit - c.length - u.length);

			const bat = this.afs.firestore.batch();
			c.forEach(ins => bat.set(this.docRef(ins[FIELD.store], ins[FIELD.id]), this.removeMeta(ins, { setUndefined: true })));
			u.forEach(upd => bat.update(this.docRef(upd[FIELD.store], upd[FIELD.id]), this.removeMeta(upd)));
			d.forEach(del => bat.delete(this.docRef(del[FIELD.store], del[FIELD.id])));
			commits.push(bat.commit());
		}

		return Promise.all(commits)
			.then(_ => true);
	}

	/** Wrap a set of database-writes within a Transaction */
	runTxn(creates: IStoreMeta[] = [], updates: IStoreMeta[] = [], deletes: IStoreMeta[] = [], selects: DocumentReference[] = []) {
		const cloneCreate = asArray(cloneObj(creates));
		const cloneUpdate = asArray(cloneObj(updates));
		const cloneDelete = asArray(cloneObj(deletes));
		const limit = 500;

		return new Promise<boolean>((resolve, reject) => {

			while (cloneCreate.length + cloneUpdate.length + cloneDelete.length) {
				const c = cloneCreate.splice(0, limit);
				const u = cloneUpdate.splice(0, limit - c.length);
				const d = cloneDelete.splice(0, limit - c.length - u.length);

				this.afs.firestore.runTransaction(txn => {
					asArray(selects).forEach(ref => txn.get(ref));
					c.forEach(ins => txn = txn.set(this.docRef(ins[FIELD.store], ins[FIELD.id]), this.removeMeta(ins)));
					u.forEach(upd => txn = txn.update(this.docRef(upd[FIELD.store], upd[FIELD.id]), this.removeMeta(upd)));
					d.forEach(del => txn = txn.delete(this.docRef(del[FIELD.store], del[FIELD.id])));

					return Promise.resolve(true);					// if any change fails, the Transaction rejects
				})
			}
			resolve(true);
		})
	}

	async setDoc(store: STORE, doc: firestore.DocumentData) {
		const docId: string = doc[FIELD.id] || this.newId();

		doc = this.removeMeta(doc);									// remove the meta-fields from the document
		await this.docRef(store, docId).set(doc);
		return docId;
	}

	async updDoc(store: STORE, docId: string, data: firestore.DocumentData) {
		data = this.removeMeta(data);
		await this.docRef(store, docId).update(data)
		return docId;
	}

	/** get all Documents, optionally with a supplied Query */
	async getAll<T>(collection: COLLECTION, query?: IQuery) {
		const snap = await this.colRef<T>(collection, query)[0]	// TODO: allow for logical-or, merge of snapshotChanges
			.snapshotChanges()
			.pipe(take(1))
			.toPromise()

		return snap.map(docs => ({ [FIELD.id]: docs.payload.doc.id, ...docs.payload.doc.data() }));
	}

	callMeta(store: STORE, docId: string) {
		return this.callHttps<IDocMeta>('readMeta', { collection: getSlice(store), [FIELD.id]: docId }, `checking ${store}`);
	}

	/** This helps an Admin impersonate another Member */
	createToken(uid: string) {
		return this.callHttps<string>('createToken', { uid }, `creating token for ${uid}`);
	}

	/** Useful when Member is already authenticated elsewhere (eg. helloJS) */
	authToken(access_token: string, user: IUserInfo) {
		return this.callHttps<string>('authToken', { access_token, ...user }, `creating token for ${user.uid}`);
	}

	/** Call a server Cloud Function */
	private callHttps<T>(fnName: string, args: Object, msg?: string) {
		const fn = this.aff.httpsCallable(fnName);
		let snack = true;																				// set a snackbar flag

		setTimeout(() => {																			// if no response in one-second, show the snackbar
			if (snack && msg) {
				this.zone.run(() =>																	// wrap snackbar in Angular Zone
					this.snack.open(msg))															// let the User know there is a delay
			}
		}, 1000);

		return fn(args)
			.pipe(tap(_ => { snack = false; this.snack.dismiss(); }))
			.toPromise<T>()
	}
}