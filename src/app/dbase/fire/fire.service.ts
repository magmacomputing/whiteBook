import { Injectable, NgZone } from '@angular/core';
import { merge, concat, Observable, combineLatest } from 'rxjs';
import { tap, take } from 'rxjs/operators';
import { firestore } from 'firebase/app';

import { AngularFirestore, DocumentReference, AngularFirestoreCollection, DocumentChangeAction } from '@angular/fire/firestore';
import { AngularFireFunctions } from '@angular/fire/functions';
import { SnackService } from '@service/material/snack.service';
import { DBaseModule } from '@dbase/dbase.module';

import { FIELD, COLLECTION } from '@dbase/data/data.define';
import { IQuery, IDocMeta } from '@dbase/fire/fire.interface';
import { IStoreMeta, ICustomClaims } from '@dbase/data/data.schema';
import { getSlice } from '@dbase/state/state.library';
import { fnQuery } from '@dbase/fire/fire.library';

import { isUndefined, isObject } from '@lib/type.library';
import { asArray } from '@lib/array.library';
import { cloneObj } from '@lib/object.library';
import { dbg } from '@lib/logger.library';


/**
 * This private service will communicate with the FireStore database,
 * and is intended to be invoked via the DataService only
 */
@Injectable({ providedIn: DBaseModule })
export class FireService {
	private dbg = dbg(this);

	constructor(private readonly afs: AngularFirestore, private readonly aff: AngularFireFunctions,
		private zone: NgZone, private snack: SnackService) { this.dbg('new'); }

	/**
	 * Collection References, with optional query.  
	 * If a 'logical-or' is detected in the 'value' of any Where-clause,
	 * multiple Collection References are returned.
	 */
	colRef<T>(collection: string, query?: IQuery) {
		return !query
			? [this.afs.collection<T>(collection)]
			: fnQuery(query)										// register an array of Querys over a collection reference
				.map(qry => this.afs.collection<T>(collection, qry));
	}

	merge<T, U extends 'stateChanges' | 'snapshotChanges' | 'auditTrail' | 'valueChanges'>(type: U, colRefs: AngularFirestoreCollection<T>[]) {
		return merge(...(colRefs.map(colRef => colRef[type]()))) as Observable<U extends 'valueChanges' ? T[] : DocumentChangeAction<T>[]>;
	}

	combine<T, U extends 'stateChanges' | 'snapshotChanges' | 'auditTrail' | 'valueChanges'>(type: U, colRefs: AngularFirestoreCollection<T>[]) {
		return combineLatest(colRefs.map(colRef => colRef[type]())) as (Observable<U extends 'valueChanges' ? T[][] : DocumentChangeAction<T>[][]>);
	}

	concat<T, U extends 'stateChanges' | 'snapshotChanges' | 'auditTrail' | 'valueChanges'>(type: U, colRefs: AngularFirestoreCollection<T>[]) {
		return concat(...(colRefs.map(colRef => colRef[type]()))) as Observable<U extends 'valueChanges' ? T[] : DocumentChangeAction<T>[]>;
	}

	/** Document Reference, for existing or new */
	docRef(store: string, docId?: string) {
		const col = store.includes('/')
			? store																// already a '/{collection}' path
			: getSlice(store)											// lookup parent collection name for a 'store'

		docId = isUndefined(docId) ? this.newId() : docId;	// use supplied Id, else generate a new Id

		return this.afs.firestore.collection(col).doc(docId);
	}

	/** allocate a new meta-field _id */
	newId() {
		return this.afs.createId();
	}

	/** Remove the meta-fields, undefined fields, low-values fields from a document */
	private removeMeta(doc: Partial<IStoreMeta>) {
		const { [FIELD.id]: a, [FIELD.create]: b, [FIELD.update]: c, [FIELD.access]: d, ...rest } = doc;
		Object.entries(rest).forEach(([key, value]) => {
			if (isUndefined(value))								// remove top-level keys with 'undefined' values
				delete rest[key];										// TODO: recurse?
			if (isObject(rest[key]) && JSON.stringify(rest[key]) === JSON.stringify({ "_methodName": "FieldValue.delete" }))
				rest[key] = firestore.FieldValue.delete();	// TODO: workaround
		})
		return rest;
	}

	/**
	 * Wrap database-writes within a set of Batches (limited to 500 documents per).  
	 * These documents are assumed to have a <store> field and (except for 'creates') an <id> field  
	 * If they are Member documents and missing a <uid> field, the current User is inserted
	 */
	batch(creates: IStoreMeta[] = [], updates: IStoreMeta[] = [], deletes: IStoreMeta[] = []) {
		const cloneCreate = asArray(cloneObj(creates));
		const cloneUpdate = asArray(cloneObj(updates));
		const cloneDelete = asArray(cloneObj(deletes));
		const limit = 300;

		return (cloneCreate.length + cloneUpdate.length + cloneDelete.length === 0)
			? Promise.resolve(undefined)										// nothing to do
			: new Promise<boolean>((resolve, reject) => {

			while (cloneCreate.length + cloneUpdate.length + cloneDelete.length) {
				const c = cloneCreate.splice(0, limit);
				const u = cloneUpdate.splice(0, limit - c.length);
				const d = cloneDelete.splice(0, limit - c.length - u.length);
				// this.dbg('batch: c: %s, u: %s, d: %s', c.length, u.length, d.length);

				const bat = this.afs.firestore.batch();

				c.forEach(ins => bat.set(this.docRef(ins[FIELD.store], ins[FIELD.id]), this.removeMeta(ins)));
				u.forEach(upd => bat.update(this.docRef(upd[FIELD.store], upd[FIELD.id]), this.removeMeta(upd)));
				d.forEach(del => bat.delete(this.docRef(del[FIELD.store], del[FIELD.id])));

				bat.commit()
					.then(_res => resolve(true))								// the first batch's result
					.catch(err => reject(err))
			}
		})
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
					c.forEach(ins => txn = txn.set(this.docRef(ins[FIELD.store]), this.removeMeta(ins)));
					u.forEach(upd => txn = txn.update(this.docRef(upd[FIELD.store], upd[FIELD.id]), this.removeMeta(upd)));
					d.forEach(del => txn = txn.delete(this.docRef(del[FIELD.store], del[FIELD.id])));

					return Promise.resolve(true);					// if any change fails, the Transaction rejects
				})
			}
			resolve(true);
		})
	}

	async setDoc(store: string, doc: Partial<IStoreMeta>) {
		const docId: string = doc[FIELD.id] || this.newId();

		doc = this.removeMeta(doc);								// remove the meta-fields from the document
		await this.docRef(store, docId).set(doc);
		return docId;
	}

	async updDoc(store: string, docId: string, data: Partial<IStoreMeta>) {
		data = this.removeMeta(data);
		await this.docRef(store, docId).update(data)
		return docId;
	}

	/** get all Documents, optionally with a supplied Query */
	async getAll<T>(collection: string, query?: IQuery) {
		const snap = await this.colRef<T>(collection, query)[0]	// TODO: allow for logical-or, merge of snapshotChanges
			.snapshotChanges()
			.pipe(take(1))
			.toPromise()

		return snap.map(docs => ({ [FIELD.id]: docs.payload.doc.id, ...docs.payload.doc.data() }));
	}

	callMeta(store: string, docId: string) {
		return this.callHttps<IDocMeta>('readMeta', { collection: getSlice(store), [FIELD.id]: docId }, `checking ${store}`);
	}

	writeClaim(claim: ICustomClaims) {
		return this.callHttps('writeClaim', { collection: COLLECTION.admin, customClaims: claim }, `setting claim`);;
	}

	// writeAccount(uid: string, summary: ISummary) {
	// 	return this.callHttps('writeAccount', { uid, summary });
	// }

	createToken(uid: string) {
		return this.callHttps<string>('createToken', { uid }, `creating token for ${uid}`);
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