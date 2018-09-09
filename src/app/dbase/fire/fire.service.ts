import { Injectable, NgZone } from '@angular/core';
import { MatSnackBar } from '@angular/material';

import { AngularFirestore } from '@angular/fire/firestore';
import { AngularFireFunctions } from '@angular/fire/functions';
import { DBaseModule } from '@dbase/dbase.module';

import { tap } from 'rxjs/operators';

import { FIELD } from '@dbase/data.define';
import { IQuery } from '@dbase/fire.interface';
import { IMeta, IStoreBase } from '@dbase/data.schema';
import { getSlice } from '@dbase/data/data.library';
import { fnQuery } from '@dbase/fire/fire.library';

import { isUndefined } from '@lib/type.library';
import { IObject } from '@lib/object.library';
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
	batch(creates: IStoreBase | IStoreBase[] = [], updates: IStoreBase | IStoreBase[] = [], deletes: IStoreBase | IStoreBase[] = []) {
		const bat = this.afs.firestore.batch();

		if (asArray(creates).length) this.dbg('creates: %j', creates);
		if (asArray(updates).length) this.dbg('updates: %j', updates);
		if (asArray(deletes).length) this.dbg('deletes: %j', deletes);
		asArray(creates).forEach(ins => bat.set(this.docRef(ins.store), this.remId(ins)));
		asArray(updates).forEach(upd => bat.update(this.docRef(upd.store, upd[FIELD.id]), this.remId(upd)));
		asArray(deletes).forEach(del => bat.delete(this.docRef(del.store, del[FIELD.id])));

		return bat.commit();
	}

	setDoc(store: string, doc: IObject<any>) {
		const docId: string = doc[FIELD.id] || this.newId();

		doc = this.remId(doc);											// remove the meta-field from the document
		return this.docRef(store, docId).set(doc)
			.then(_ => docId)
	}

	updDoc(store: string, docId: string, data: IObject<any>) {
		data = this.remId(data);
		return this.docRef(store, docId).update(data)
			.then(_ => docId);
	}

	getDoc(store: string, docId: string) {
		return this.docRef(store, docId).get()
	}

	getMeta(store: string, docId: string): Promise<{
		exists: boolean;
		[FIELD.id]: string;
		[FIELD.create]: number | undefined;
		[FIELD.update]: number | undefined;
		[FIELD.access]: number | undefined;
		subcollections: string[];
		path: string;
	}> {
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
			.toPromise()
	}
}