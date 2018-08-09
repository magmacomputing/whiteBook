import { Injectable, NgZone } from '@angular/core';
import { MatSnackBar } from '@angular/material';
import { tap } from 'rxjs/operators';

import { AngularFirestore } from 'angularfire2/firestore';
import { AngularFireFunctions } from 'angularfire2/functions';
import { DBaseModule } from '@dbase/dbase.module';

import { FIELD } from '@dbase/data/data.define';
import { getSlice } from '@dbase/data/data.library';
import { IMeta, IStoreBase } from '@dbase/data/data.schema';
import { IQuery } from '@dbase/fire/fire.interface';
import { fnQuery } from '@dbase/fire/fire.library';

import { isUndefined, IObject, asArray } from '@lib/object.library';
import { dbg } from '@lib/logger.library';
import { Observable } from 'rxjs';

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
	batch(creates: IStoreBase[] = [], updates: IStoreBase[] = [], deletes: IStoreBase[] = []) {
		const bat = this.afs.firestore.batch();

		if (creates.length) this.dbg('creates: %j', creates);
		if (updates.length) this.dbg('updates: %j', updates);
		if (deletes.length) this.dbg('deletes: %j', deletes);
		asArray(creates).forEach(ins => bat.set(this.docRef(ins.store), this.remId(ins)));
		asArray(updates).forEach(upd => bat.update(this.docRef(upd.store, upd[FIELD.id]), this.remId(upd)));
		asArray(deletes).forEach(del => bat.delete(this.docRef(del.store, del[FIELD.id])));

		return bat.commit();
	}

	setDoc(store: string, doc: IObject<any>) {
		const docId: string = doc[FIELD.id] || this.newId();

		delete doc[FIELD.id];											// remove the meta-field from the document
		return this.afs.firestore
			.collection(store)
			.doc(docId)
			.set(doc)
	}

	updDoc(store: string, docId: string, data: IObject<any>) {
		delete data[FIELD.id];
		return this.afs.firestore
			.collection(store)
			.doc(docId)
			.update(data)
	}

	getDoc(store: string, docId: string) {
		return this.afs.firestore
			.collection(store)
			.doc(docId)
			.get()
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
		const readMeta = this.aff.httpsCallable('readMeta');
		let snack = true;

		setTimeout(() => {                                    // if no response in one-second, show the snackbar
			if (snack) {
				this.zone.run(_ =>																// wrap snackbar in Angular Zone
					this.snack.open(`checking ${store}`))						// let the User know there is a delay
			}
		}, 1000);

		return readMeta({ collection: store, [FIELD.id]: docId })
			.pipe(tap(_ => { snack = false; this.snack.dismiss(); }))
			.toPromise()
	}
}