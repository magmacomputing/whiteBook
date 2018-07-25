import { Injectable } from '@angular/core';
import { AngularFirestore } from 'angularfire2/firestore';
import { AngularFireFunctions } from 'angularfire2/functions';
import { DBaseModule } from '@dbase/dbase.module';

import { FIELD } from '@dbase/data/data.define';
import { IQuery } from '@dbase/fire/fire.interface';
import { fnQuery } from '@dbase/fire/fire.library';

import { isUndefined, IObject } from '@lib/object.library';
import { dbg } from '@lib/logger.library';

/**
 * This private service will communicate with the FireStore database,
 * (via the DataService)
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
		return isUndefined(docId)
			? this.af.firestore.collection(store).doc()
			: this.af.firestore.collection(store).doc(docId)
	}

	newId() {
		return this.af.createId();
	}

	/** Instantiate a new WriteBatch */
	bat() {
		return this.af.firestore.batch();
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

	getMeta(store: string, docId: string) {
		const readMeta = this.fn.httpsCallable('readMeta');
		return readMeta({ collection: store, [FIELD.id]: docId })
			.toPromise()
	}
}