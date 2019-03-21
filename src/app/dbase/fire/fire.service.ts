import { Injectable, NgZone } from '@angular/core';
import { concat, combineLatest } from 'rxjs';
import { tap, take, switchMap } from 'rxjs/operators';
import * as firebase from 'firebase/app';

import { AngularFirestore, DocumentReference, AngularFirestoreCollection, DocumentChangeAction } from '@angular/fire/firestore';
import { AngularFireFunctions } from '@angular/fire/functions';
import { SnackService } from '@service/snack/snack.service';
import { DBaseModule } from '@dbase/dbase.module';

import { FIELD, COLLECTION } from '@dbase/data/data.define';
import { IQuery, IDocMeta } from '@dbase/fire/fire.interface';
import { TStoreBase, IStoreMeta, ICustomClaims } from '@dbase/data/data.schema';
import { getSlice } from '@dbase/state/state.library';
import { fnQuery } from '@dbase/fire/fire.library';

import { isUndefined } from '@lib/type.library';
import { asArray } from '@lib/array.library';
import { dbg } from '@lib/logger.library';

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

	/** Collection Reference, with optional query */
	colRef<T>(store: string, query?: IQuery) {
		return fnQuery(query).map(qry => this.afs.collection<T>(store, qry));
	}

	/** Combine Collection References, snapshot each, merge Observable */
	combine<T>(changes: 'stateChanges' | 'valueChanges' | 'snapshotChanges' | 'auditTrail', ...colRefs: AngularFirestoreCollection[]) {
		return combineLatest(...colRefs.map(ref => ref[changes]()))
			.pipe(switchMap(refs => concat<DocumentChangeAction<T>[][]>(...refs)))
	}

	/** Document Reference, for existing or new */
	docRef(store: string, docId?: string) {
		const col = store.includes('/')
			? store																// already a '/{collection}' path
			: getSlice(store)											// lookup parent collection name for a 'store'

		docId = isUndefined(docId) ? this.newId() : docId;	// use supplied Id, else generate a new Id

		return this.afs.firestore.collection(col).doc(docId)
	}

	/** allocate a new meta-field _id */
	newId() {
		return this.afs.createId();
	}

	/** Remove the meta-fields, undefined fields, low-values fields from a document */
	private remMeta(doc: Partial<IStoreMeta>) {
		const { [FIELD.id]: a, [FIELD.create]: b, [FIELD.update]: c, [FIELD.access]: d, ...rest } = doc;
		Object.entries(rest).forEach(([key, value]) => {
			if (isUndefined(value))								// remove top-level keys with 'undefined' values
				delete rest[key];										// TODO: recurse?
			if (value === Number.MIN_SAFE_INTEGER)
				rest[key] = firebase.firestore.FieldValue.delete();
		})
		return rest;
	}

	/** Wrap a set of database-writes within a Batch */
	batch(creates: TStoreBase[] = [], updates: TStoreBase[] = [], deletes: TStoreBase[] = []) {
		const bat = this.afs.firestore.batch();

		asArray(creates).forEach(ins => bat.set(this.docRef(ins[FIELD.store]), this.remMeta(ins)));
		asArray(updates).forEach(upd => bat.update(this.docRef(upd[FIELD.store], upd[FIELD.id]), this.remMeta(upd)));
		asArray(deletes).forEach(del => bat.delete(this.docRef(del[FIELD.store], del[FIELD.id])));

		return bat.commit();
	}

	/** Wrap a set of database-writes within a Transaction */
	runTxn(creates: TStoreBase[] = [], updates: TStoreBase[] = [], deletes: TStoreBase[] = [], selects: DocumentReference[] = []) {
		return this.afs.firestore.runTransaction(txn => {
			asArray(selects).forEach(ref => txn.get(ref));
			asArray(creates).forEach(ins => txn = txn.set(this.docRef(ins[FIELD.store]), this.remMeta(ins)));
			asArray(updates).forEach(upd => txn = txn.update(this.docRef(upd[FIELD.store], upd[FIELD.id]), this.remMeta(upd)));
			asArray(deletes).forEach(del => txn = txn.delete(this.docRef(del[FIELD.store], del[FIELD.id])));

			return Promise.resolve(true);					// if any change fails, the Transaction rejects
		})
	}

	async setDoc(store: string, doc: Partial<IStoreMeta>) {
		const docId: string = doc[FIELD.id] || this.newId();

		doc = this.remMeta(doc);								// remove the meta-fields from the document
		await this.docRef(store, docId).set(doc);
		return docId;
	}

	async updDoc(store: string, docId: string, data: Partial<IStoreMeta>) {
		data = this.remMeta(data);
		await this.docRef(store, docId).update(data)
		return docId;
	}

	/** get all Documents, optionally with a supplied Query */
	async getAll<T>(collection: string, query?: IQuery) {
		const snap = await this.colRef<T>(collection, query)[0]
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