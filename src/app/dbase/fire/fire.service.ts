import { Injectable, NgZone } from '@angular/core';
import { tap } from 'rxjs/operators';

import { AngularFirestore } from '@angular/fire/firestore';
import { AngularFireFunctions } from '@angular/fire/functions';
import { SnackService } from '@service/snack/snack.service';
import { DBaseModule } from '@dbase/dbase.module';

import { FIELD, STORE, COLLECTION } from '@dbase/data/data.define';
import { IQuery, IDocMeta } from '@dbase/fire/fire.interface';
import { TStoreBase, IStoreMeta, ICustomClaims } from '@dbase/data/data.schema';
import { getSlice } from '@dbase/data/data.library';
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

	/** Collection Reference, with option query */
	colRef<T>(store: string, query?: IQuery) {
		return this.afs.collection<T>(store, fnQuery(query));
	}

	/** Document Reference, for existing or new */
	docRef(store: string, docId?: string) {
		const col = store.includes('/')
			? store																// already a '/{collection}' path
			: getSlice(store)											// lookup parent collection path for a 'store'

		return isUndefined(docId)
			? this.afs.firestore.collection(col).doc()
			: this.afs.firestore.collection(col).doc(docId)
	}

	/** allocate a new meta-field _id */
	newId() {
		return this.afs.createId();
	}

	/** Remove the meta-fields and undefined fields from a document */
	private remMeta(doc: Partial<IStoreMeta>) {
		const { [FIELD.id]: a, [FIELD.create]: b, [FIELD.update]: c, [FIELD.access]: d, ...rest } = doc;
		Object.entries(rest).forEach(([key, value]) => {
			if (isUndefined(value))								// remove top-level keys with 'undefined' values
				delete rest[key];										// TODO: recurse?
		})
		return rest;
	}

	/** Batch a set of database-writes */
	async batch(creates: TStoreBase[] = [], updates: TStoreBase[] = [], deletes: TStoreBase[] = []) {
		const bat = this.afs.firestore.batch();

		asArray(creates).forEach(ins => bat.set(this.docRef(ins[FIELD.store]), this.remMeta(ins)));
		asArray(updates).forEach(upd => bat.update(this.docRef(upd[FIELD.store], upd[FIELD.id]), this.remMeta(upd)));
		asArray(deletes).forEach(del => bat.delete(this.docRef(del[FIELD.store], del[FIELD.id])));

		bat.commit();
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

	callMeta(store: string, docId: string) {
		return this.callHttps<IDocMeta>('readMeta', { collection: getSlice(store), [FIELD.id]: docId }, `checking ${store}`);
	}

	writeClaim(claim: ICustomClaims) {
		return this.callHttps('writeClaim', { collection: COLLECTION.register, customClaims: claim }, `setting claim`);;
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