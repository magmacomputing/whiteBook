import { Injectable, NgZone } from '@angular/core';
import firebase from 'firebase/app';

import { environment } from '@env/environment';
import { SnackService } from '@service/material/snack.service';

import { DBaseModule } from '@dbase/dbase.module';
import { FIELD, COLLECTION, STORE } from '@dbase/data.define';
import { fire } from '@dbase/fire/fire.library';
import { FireDocument } from '@dbase/data.schema';
import { getSlice } from '@dbase/state/state.library';

import { isArray, isDefined, isIterable, isObject, isUndefined } from '@library/type.library';
import { isNumeric } from '@library/string.library';
import { cloneObj } from '@library/object.library';
import { asArray } from '@library/array.library';
import { dbg } from '@library/logger.library';
import { from } from 'rxjs';

/**
 * This private service will communicate with the FireStore database,  
 * and is intended to be invoked via the DataService only
 */
@Injectable({ providedIn: DBaseModule })
export class FireService {
	#app: firebase.app.App;
	#fire: firebase.firestore.Firestore;
	#dbg = dbg(this);

	constructor(private zone: NgZone, private snack: SnackService) {
		this.#dbg('new');

		this.#app = firebase.initializeApp(environment.firebase.prod);
		this.#fire = this.#app.firestore();
		this.#fire.enablePersistence({ synchronizeTabs: environment.firebase.config.synchronizeTabs });
	}

	private queryRef<T>(collection: COLLECTION, query: fire.Query = {}) {
		let colRef: firebase.firestore.Query = this.#fire.collection(collection);

		asArray(query.where)
			.filter(where => isDefined(where.value))												// discard queries for 'undefined' value; not supported
			.forEach(where => colRef = colRef.where(
				where.fieldPath,
				(where.opStr || (isIterable(where.value) ? 'in' : '==')),
				isIterable(where.value) ? asArray(where.value) : where.value)	// coerce Set to Array
			);

		if (query.orderBy)
			asArray(query.orderBy)
				.forEach(order => colRef = colRef.orderBy(order.fieldPath, order.directionStr));

		if (isNumeric(query.limit))
			colRef = colRef.limit(query.limit);

		if (query.startAt)
			colRef = colRef.startAt(query.startAt);

		if (query.startAfter)
			colRef = colRef.startAfter(query.startAfter);

		if (query.endAt)
			colRef = colRef.endAt(query.endAt);

		if (query.endBefore)
			colRef = colRef.endBefore(query.endBefore);

		return colRef as firebase.firestore.CollectionReference<T>;
	}

	on<T>(collection: COLLECTION, query: fire.Query = {}, callBack: (snapshot: firebase.firestore.QuerySnapshot<T>) => any) {
		return this.queryRef<T>(collection, query)
			.onSnapshot(callBack)
	}

	select<T>(collection: COLLECTION, query?: fire.Query) {
		return this.queryRef<T>(collection, query)
			.get({ source: 'server' })								// get the server-data, rather than cache
			.then(snap => snap.docs.map(doc => ({ ...doc.data(), [FIELD.Id]: doc.id } as unknown as T)))
	}

	listen<T>(collection: COLLECTION, query?: fire.Query) {
		return from(this.select<T>(collection, query));
	}

	/** Document Reference, for existing or new */
	private docRef<T>(doc: FireDocument) {
		const collection = getSlice(doc[FIELD.Store]);
		const docId = doc[FIELD.Id] ?? this.newId(doc[FIELD.Store]);

		return this.queryRef<T>(collection).doc(docId);
	}

	/** manage connectivity */
	connect(onOff: boolean) {
		return onOff
			? this.#fire.enableNetwork()							// reconnect Cloud Firestore
			: this.#fire.disableNetwork()							// disconnect Cloud Firestore
	}

	/** allocate a new meta-field _id */
	newId(store: COLLECTION | STORE) {
		const collection = getSlice(store);
		return this.queryRef(collection).doc().id;
	}

	/** Remove the meta-fields, undefined fields, low-values fields from a document */
	private removeMeta<T extends FireDocument>(doc: T, opts?: Record<string, boolean>) {
		const { [FIELD.Id]: a, [FIELD.Create]: b, [FIELD.Update]: c, [FIELD.Access]: d, ...rest } = doc;

		this.fieldValue(rest, opts);								// start recursion into Document

		return rest as Exclude<T, FIELD.Id | FIELD.Create | FIELD.Update | FIELD.Access>;
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

			const bat = this.#fire.batch();
			c.forEach(ins => bat.set(this.docRef(ins), this.removeMeta(ins, { setUndefined: true })));
			u.forEach(upd => bat.update(this.docRef(upd), this.removeMeta(upd)));
			d.forEach(del => bat.delete(this.docRef(del)));
			commits.push(bat.commit());
		}

		return Promise.all(commits)
			.then(_ => true);
	}

	/** Wrap a set of database-writes within a Transaction */
	runTxn(creates: FireDocument[] = [], updates: FireDocument[] = [], deletes: FireDocument[] = [], selects: firebase.firestore.DocumentReference[] = []) {
		const cloneCreate = asArray(cloneObj(creates));
		const cloneUpdate = asArray(cloneObj(updates));
		const cloneDelete = asArray(cloneObj(deletes));
		const limit = 500;

		return new Promise<boolean>((resolve, reject) => {

			while (cloneCreate.length + cloneUpdate.length + cloneDelete.length) {
				const c = cloneCreate.splice(0, limit);
				const u = cloneUpdate.splice(0, limit - c.length);
				const d = cloneDelete.splice(0, limit - c.length - u.length);

				this.#fire.runTransaction(txn => {
					asArray(selects).forEach(ref => txn.get(ref));
					c.forEach(ins => txn = txn.set(this.docRef(ins), this.removeMeta(ins, { setUndefined: true })));
					u.forEach(upd => txn = txn.update(this.docRef(upd), this.removeMeta(upd)));
					d.forEach(del => txn = txn.delete(this.docRef(del)));

					return Promise.resolve(true);					// if any change fails, the Transaction rejects
				})
			}
			resolve(true);
		})
	}

	insert(data: FireDocument) {
		const docId = data[FIELD.Id] || this.newId(data[FIELD.Store]);

		data = this.removeMeta(data);																// remove the meta-fields from the document
		return this.docRef(data).set(data)
			.then(() => docId);
	}

	update(data: FireDocument) {
		const docId = data[FIELD.Id];

		data = this.removeMeta(data);
		return this.docRef(data).update(data)
	}

	delete(data: FireDocument) {
		return this.docRef(data).delete();
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
		const fn = this.#app.functions().httpsCallable(fnName);
		let snack = true;																				// set a snackbar flag

		setTimeout(() => {																			// if no response in one-second, show the snackbar
			if (snack && msg) {
				this.zone.run(() =>																	// wrap snackbar in Angular Zone
					this.snack.open(msg))															// let the User know there is a delay
			}
		}, 1000);

		return fn(args)
			.then(res => res.data as T)
			.finally(() => { snack = false; this.snack.dismiss() })
	}
}
