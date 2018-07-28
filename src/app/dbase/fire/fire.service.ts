import { Injectable } from '@angular/core';
import { AngularFirestore } from 'angularfire2/firestore';
import { AngularFireFunctions } from 'angularfire2/functions';
import { DBaseModule } from '@dbase/dbase.module';

import { FIELD } from '@dbase/data/data.define';
import { IMeta } from '@dbase/data/data.schema';
import { IQuery } from '@dbase/fire/fire.interface';
import { fnQuery } from '@dbase/fire/fire.library';

import { isUndefined, IObject, asArray } from '@lib/object.library';
import { dbg } from '@lib/logger.library';
import { getSlice } from '@dbase/data/data.library';

/**
 * This private service will communicate with the FireStore database,
 * and is intended to be invoked via the DataService only
 */
@Injectable({ providedIn: DBaseModule })
export class FireService {
	private dbg: Function = dbg.bind(this);

	constructor(private readonly af: AngularFirestore, private readonly fn: AngularFireFunctions) {
		this.dbg('new');
	}

	/** Collection Reference, with option query */
	colRef(store: string, query?: IQuery) {
		return this.af.collection(store, fnQuery(query));
	}

	/** Document Reference, for existing or new */
	docRef(store: string, docId?: string) {
		const slice = getSlice(store);
		return isUndefined(docId)
			? this.af.firestore.collection(slice).doc()
			: this.af.firestore.collection(slice).doc(docId)
	}

	/** allocate a new meta-field _id */
	newId() {
		return this.af.createId();
	}

	/** Remove the meta-field _id */
	private remId(doc: IMeta) {
		delete doc[FIELD.id];
		return doc;
	}

	/** Batch a set of changes */
	batch(inserts: any = [], updates: any = [], deletes: any = []) {
		const bat = this.af.firestore.batch();

		asArray(inserts).forEach(ins => bat.set(this.docRef(ins.store), this.remId(ins)));
		asArray(updates).forEach(upd => bat.update(this.docRef(upd.store, upd[FIELD.id]), this.remId(upd)));
		asArray(deletes).forEach(del => bat.delete(this.docRef(del.store, del[FIELD.id])));

		return bat.commit();
	}

	setDoc(store: string, doc: IObject<any>) {
		const docId: string = doc[FIELD.id] || this.newId();

		delete doc[FIELD.id];											// remove the meta-field from the document
		return this.af.firestore
			.collection(store)
			.doc(docId)
			.set(doc)
	}

	updDoc(store: string, docId: string, data: IObject<any>) {
		delete data[FIELD.id];
		return this.af.firestore
			.collection(store)
			.doc(docId)
			.update(data)
	}

	getDoc(store: string, docId: string) {
		return this.af.firestore
			.collection(store)
			.doc(docId)
			.get()
	}

	getMeta(store: string, docId: string): Promise<{
		exists: boolean;
		[FIELD.id]: string;
		[FIELD.create]: number;
		[FIELD.update]: number | undefined;
		[FIELD.access]: number | undefined;
		subcollections: string[];
		path: string;
	}> {
		const readMeta = this.fn.httpsCallable('readMeta');

		return readMeta({ collection: store, [FIELD.id]: docId })
			.toPromise()
	}
}