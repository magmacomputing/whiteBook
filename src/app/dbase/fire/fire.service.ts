import { Injectable, NgZone } from '@angular/core';
import { Observable, combineLatest, merge, concat } from 'rxjs';
import { tap, take, map } from 'rxjs/operators';

import firebase from 'firebase/app';
import { AngularFirestore, AngularFirestoreCollection, DocumentReference, DocumentChangeAction, DocumentData } from '@angular/fire/firestore';
import { AngularFireFunctions, } from '@angular/fire/functions';
import { SnackService } from '@service/material/snack.service';

import { DBaseModule } from '@dbase/dbase.module';
import { FIELD, COLLECTION, STORE } from '@dbase/data.define';
import { fire } from '@dbase/fire/fire.library';
import { FireDocument } from '@dbase/data.schema';
import { getSlice } from '@dbase/state/state.library';

import { isArray, isObject, isUndefined } from '@library/type.library';
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
	#dbg = dbg(this);

	constructor(private readonly afs: AngularFirestore, private readonly aff: AngularFireFunctions,
		private zone: NgZone, private snack: SnackService) {
		this.#dbg('new');
	}

	/**
	 * return Collection References (limited by an optional query).  
	 * If a 'logical-or' is detected in the 'value' of any query's Where-clause, multiple Collection References are returned.
	 */
	colRef<T>(collection: COLLECTION, query?: fire.Query) {
		return isUndefined(query)
			? [this.afs.collection<T>(collection)]		// reference against the entire collection
			: fire.fnQuery(query)													// else register an array of Querys over a collection reference
				.map(qry => this.afs.collection<T>(collection, qry));
	}

	private subRef<T, U extends TChanges>(colRefs: AngularFirestoreCollection<T>[], type: U) {
		return colRefs.map(colRef => colRef[type]()) as Observable<U extends 'valueChanges' ? T[] : DocumentChangeAction<T>[]>[];
	}

	merge<T, U extends TChanges>(colRefs: AngularFirestoreCollection<T>[], type: U) {
		return merge(...this.subRef(colRefs, type));
	}

	concat<T, U extends TChanges>(colRefs: AngularFirestoreCollection<T>[], type: U) {
		return concat([...this.subRef(colRefs, type)]);
	}

	combine<T, U extends TChanges>(colRefs: AngularFirestoreCollection<T>[], type: U) {
		return combineLatest([...this.subRef<T, U>(colRefs, type)])
			.pipe(map(obs => obs.flat()))								// flatten the array-of-values results
	}

	listen<T>(collection: COLLECTION, query?: fire.Query) {
		return this.combine<T, 'snapshotChanges'>(this.colRef<T>(collection, query), 'snapshotChanges')
			.pipe(map(snap => snap.map(docs => ({ ...docs.payload.doc.data(), [FIELD.Id]: docs.payload.doc.id, } as T))))
	}

	get<T>(collection: COLLECTION, query?: fire.Query) {
		return this.afs
			.collection<T>(collection, fire.fnQuery(query)[0])
			.get({ source: 'server' })								// get the server-data, rather than cache
			.toPromise()
			.then(snap => snap.docs.map(doc => ({ ...doc.data(), [FIELD.Id]: doc.id } as unknown as T)))
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
	private removeMeta(doc: DocumentData, opts?: Record<string, boolean>) {
		const { [FIELD.Id]: a, [FIELD.Create]: b, [FIELD.Update]: c, [FIELD.Access]: d, ...rest } = doc;

		this.fieldValue(rest, opts);								// start recursion into Document

		return rest;
	}

	/** Replace 'undefined' with FieldValue.delete() */
	private fieldValue(obj: Record<string, any>, opts: Record<string, boolean> = {}) {
		Object.entries(obj)
			.forEach(([key, value], idx) => {
				if (isObject(value))
					return this.fieldValue(value, opts);
				if (isArray(value) && (value as any[]).some(itm => isUndefined(itm)))
					return this.fieldValue(value, { splice: true });

				if (isUndefined(value)) {
					switch (true) {
						case opts.setUndefined:
							return delete obj[key];
						case opts.splice:
							return obj.splice(idx, 1);
						default:
							return obj[key] = firebase.firestore.FieldValue.delete();
					}
				}
			})
	}

	/**
	 * Wrap database-writes within a set of Batches (limited to 300 documents per).  
	 * These documents are assumed to have a FIELD.store and (except for 'creates') a FIELD.id  
	 * If they are Member documents and missing a <uid> field, the current User is inserted  
	 * Perform all creates first, then all updates, finally all deletes
	 */
	batch(creates: FireDocument[] = [], updates: FireDocument[] = [], deletes: FireDocument[] = []) {
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
			c.forEach(ins => bat.set(this.docRef(ins[FIELD.Store], ins[FIELD.Id]), this.removeMeta(ins, { setUndefined: true })));
			u.forEach(upd => bat.update(this.docRef(upd[FIELD.Store], upd[FIELD.Id]), this.removeMeta(upd)));
			d.forEach(del => bat.delete(this.docRef(del[FIELD.Store], del[FIELD.Id])));
			commits.push(bat.commit());
		}

		return Promise.all(commits)
			.then(_ => true);
	}

	/** Wrap a set of database-writes within a Transaction */
	runTxn(creates: FireDocument[] = [], updates: FireDocument[] = [], deletes: FireDocument[] = [], selects: DocumentReference[] = []) {
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
					c.forEach(ins => txn = txn.set(this.docRef(ins[FIELD.Store], ins[FIELD.Id]), this.removeMeta(ins)));
					u.forEach(upd => txn = txn.update(this.docRef(upd[FIELD.Store], upd[FIELD.Id]), this.removeMeta(upd)));
					d.forEach(del => txn = txn.delete(this.docRef(del[FIELD.Store], del[FIELD.Id])));

					return Promise.resolve(true);					// if any change fails, the Transaction rejects
				})
			}
			resolve(true);
		})
	}

	async setDoc(store: STORE, doc: DocumentData) {
		const docId: string = doc[FIELD.Id] || this.newId();

		doc = this.removeMeta(doc);									// remove the meta-fields from the document
		await this.docRef(store, docId).set(doc);
		return docId;
	}

	async updDoc(store: STORE, docId: string, data: DocumentData) {
		data = this.removeMeta(data);
		await this.docRef(store, docId).update(data)
		return docId;
	}

	/** get all Documents, optionally with a supplied Query */
	async getAll<T>(collection: COLLECTION, query?: fire.Query) {
		const snap = await this.colRef<T>(collection, query)[0]	// TODO: allow for logical-or, merge of snapshotChanges
			.snapshotChanges()
			.pipe(take(1))
			.toPromise()

		return snap.map(docs => ({ ...docs.payload.doc.data(), [FIELD.Id]: docs.payload.doc.id }));
	}

	callMeta(store: STORE, docId: string) {
		return this.callHttps<fire.DocMeta>('readMeta', { collection: getSlice(store), [FIELD.Id]: docId }, `checking ${store}`);
	}

	/** This helps an Admin impersonate another Member */
	createToken(uid: string) {
		return this.callHttps<string>('createToken', { uid }, `creating token for ${uid}`);
	}

	/** Useful when Member is already authenticated elsewhere (eg. helloJS) */
	authToken(access_token: string, user: firebase.UserInfo) {
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
