import { Injectable, NgZone } from '@angular/core';
import { MatSnackBar } from '@angular/material';
import { tap } from 'rxjs/operators';

import { AngularFirestore } from '@angular/fire/firestore';
import { AngularFireFunctions } from '@angular/fire/functions';
import { DBaseModule } from '@dbase/dbase.module';

import { FIELD } from '@dbase/data/data.define';
import { IQuery, IDocMeta } from '@dbase/fire/fire.interface';
import { IMeta, TStoreBase } from '@dbase/data/data.schema';
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
	private dbg: Function = dbg.bind(this);

	constructor(private readonly afs: AngularFirestore, private readonly aff: AngularFireFunctions,
		private zone: NgZone, private snack: MatSnackBar) {
		this.dbg('new');
	}

	/** Collection Reference, with option query */
	colRef(store: string, query?: IQuery) {
		return this.afs.collection(store, fnQuery(query));
	}

	/** Document Reference, for existing or new */
	docRef(store: string, docId?: string) {
		const slice = getSlice(store);

		return isUndefined(docId)
			? this.afs.firestore.collection(slice).doc()
			: this.afs.firestore.collection(slice).doc(docId)
	}

	/** allocate a new meta-field _id */
	newId() {
		return this.afs.createId();
	}

	/** Remove the meta-field _id */
	private remId(doc: IMeta) {
		delete doc[FIELD.id];
		return doc;
	}

	/** Batch a set of database-writes */
	async batch(creates: TStoreBase[] = [], updates: TStoreBase[] = [], deletes: TStoreBase[] = []) {
		const bat = this.afs.firestore.batch();

		// if (asArray(creates).length) this.dbg('creates: %j', asArray(creates).length);
		// if (asArray(updates).length) this.dbg('updates: %j', asArray(updates).length);
		// if (asArray(deletes).length) this.dbg('deletes: %j', asArray(deletes).length);
		asArray(creates).forEach(ins => bat.set(this.docRef(ins[FIELD.store]), this.remId(ins)));
		asArray(updates).forEach(upd => bat.update(this.docRef(upd[FIELD.store], upd[FIELD.id]), this.remId(upd)));
		asArray(deletes).forEach(del => bat.delete(this.docRef(del[FIELD.store], del[FIELD.id])));

		bat.commit();
	}

	async setDoc(store: string, doc: IMeta) {
		const docId: string = doc[FIELD.id] || this.newId();

		doc = this.remId(doc);											// remove the meta-field from the document
		await this.docRef(store, docId).set(doc);
		return docId;
	}

	async updDoc(store: string, docId: string, data: IMeta) {
		data = this.remId(data);
		await this.docRef(store, docId).update(data)
		return docId;
	}

	getDoc(store: string, docId: string) {
		return this.docRef(store, docId).get()
	}

	getMeta(store: string, docId: string) {
		const slice = getSlice(store);
		const readMeta = this.aff.httpsCallable('readMeta');
		let snack = true;

		setTimeout(() => {                                    // if no response in one-second, show the snackbar
			if (snack) {
				this.zone.run(_ =>																// wrap snackbar in Angular Zone
					this.snack.open(`checking ${store}`))						// let the User know there is a delay
			}
		}, 1000);

		return readMeta({ collection: slice, [FIELD.id]: docId })
			.pipe(tap(_ => { snack = false; this.snack.dismiss(); }))
			.toPromise<IDocMeta>()
	}
}