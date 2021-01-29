import firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/firestore';
import 'firebase/functions';

import { Injectable, NgZone } from '@angular/core';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { environment } from '@env/environment';
import { SnackService } from '@service/material/snack.service';

import { DBaseModule } from '@dbase/dbase.module';
import { COLLECTION, STORE, FIELD } from '@dbase/data.define';
import { fire } from '@dbase/fire/fire.library';
import type { FireDocument } from '@dbase/data.schema';
import { getSlice, isCollection } from '@dbase/state/state.library';

import { isArray, isIterable, isObject, isDefined, isUndefined, getEnumKeys } from '@library/type.library';
import { isNumeric } from '@library/string.library';
import { cloneObj } from '@library/object.library';
import { asArray } from '@library/array.library';
import { dbg } from '@library/logger.library';

/**
 * This private service will communicate with Firebase and the FireStore database,  
 * It is intended to be invoked via the DataService only
 */
@Injectable({ providedIn: DBaseModule })
export class FireService {
	#dbg = dbg(this);

	#auth: firebase.auth.Auth;
	#fire: firebase.firestore.Firestore;
	#functions: firebase.functions.Functions;

	constructor(private zone: NgZone, private snack: SnackService) {
		const app = firebase.initializeApp(environment.firebase.prod, environment.firebase.config.name);

		this.#auth = firebase.auth(app);
		this.#fire = firebase.firestore(app);
		this.#functions = firebase.functions(app);

		this.#fire.enablePersistence({ synchronizeTabs: environment.firebase.config.synchronizeTabs });
		this.#dbg('new: %s', app.name);
	}

	get auth() {
		return this.#auth;
	}

	private collectionReference<T>(collection: COLLECTION): firebase.firestore.CollectionReference<T>;
	private collectionReference<T>(collection: COLLECTION, query?: fire.Query): firebase.firestore.Query<T>;
	private collectionReference(collection: COLLECTION, query: fire.Query = {}) {
		let colRef: firebase.firestore.Query;

		if (collection.includes('/')) {
			const uid = this.#auth.currentUser?.uid;												// TODO:  must always include {{uid}} ?
			if (isUndefined(uid))
				throw new Error('Must be signedIn to Firebasse');

			const subcollection = collection.replace('{{uid}}', uid);
			colRef = this.#fire.collectionGroup(subcollection);							// TODO:  is a sub-collection always a CollectionGroup ?
		}
		else
			colRef = this.#fire.collection(collection);

		asArray(query.where)
			.filter(where => isDefined(where.value))												// discard queries for 'undefined' value; not supported
			.forEach(where => colRef = colRef.where(
				where.fieldPath,
				(where.opStr || (isIterable(where.value) ? 'in' : '==')),
				isIterable(where.value) ? asArray(where.value) : where.value)	// coerce Iterable to Array
			);

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

		return colRef;
	}

	/** Document Reference, for existing or new */
	private documentReference<T>(doc: FireDocument) {
		const collection = getSlice(doc[FIELD.Store]);
		const docId = doc[FIELD.Id] ?? this.newId(doc[FIELD.Store]);

		return this.#fire.collection(collection).doc(docId);
	}

	on<T>(collection: COLLECTION, query: fire.Query = {}, callBack: (snapshot: firebase.firestore.QuerySnapshot<T>) => any) {
		return this.collectionReference<T>(collection, query)
			.onSnapshot(callBack)
	}

	/** manage connectivity */
	connect(onOff: boolean) {
		return onOff
			? this.#fire.enableNetwork()							// reconnect Cloud Firestore
			: this.#fire.disableNetwork()							// disconnect Cloud Firestore
	}

	/** allocate a new document _id */
	newId(store: COLLECTION | STORE) {
		const collection = getSlice(store);

		return this.#fire.collection(collection).doc().id;
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
	 * NOTE: a large number of writes may be split into multiple Batches, where the first suceeds and subsequent fails.  
	 */
	batch(creates: FireDocument[] = [], updates: FireDocument[] = [], deletes: FireDocument[] = []) {
		const limit = 300;
		const cloneCreate = [...asArray(creates)];
		const cloneUpdate = [...asArray(updates)];
		const cloneDelete = [...asArray(deletes)];
		const commits: Promise<void>[] = [];

		while (cloneCreate.length + cloneUpdate.length + cloneDelete.length) {
			const c = cloneCreate.splice(0, limit);
			const u = cloneUpdate.splice(0, limit - c.length);
			const d = cloneDelete.splice(0, limit - c.length - u.length);

			const bat = this.#fire.batch();
			c.forEach(ins => bat.set(this.documentReference(ins), this.removeMeta(ins, { setUndefined: true })));
			u.forEach(upd => bat.update(this.documentReference(upd), this.removeMeta(upd)));
			d.forEach(del => bat.delete(this.documentReference(del)));
			commits.push(bat.commit());
		}

		return Promise.all(commits)
			.then(_ => true);
	}

	/** Wrap a set of database-writes within a Transaction */
	transact(creates: FireDocument[] = [], updates: FireDocument[] = [], deletes: FireDocument[] = [], selects: firebase.firestore.DocumentReference[] = []) {
		const cloneCreate = asArray(cloneObj(creates));
		const cloneUpdate = asArray(cloneObj(updates));
		const cloneDelete = asArray(cloneObj(deletes));
		const limit = 500;

		return new Promise<boolean>(resolve => {

			while (cloneCreate.length + cloneUpdate.length + cloneDelete.length) {
				const c = cloneCreate.splice(0, limit);
				const u = cloneUpdate.splice(0, limit - c.length);
				const d = cloneDelete.splice(0, limit - c.length - u.length);

				this.#fire.runTransaction(txn => {
					asArray(selects).forEach(ref => txn.get(ref));
					c.forEach(ins => txn = txn.set(this.documentReference(ins), this.removeMeta(ins, { setUndefined: true })));
					u.forEach(upd => txn = txn.update(this.documentReference(upd), this.removeMeta(upd)));
					d.forEach(del => txn = txn.delete(this.documentReference(del)));

					return Promise.resolve(true);					// if any change fails, the Transaction rejects
				})
			}

			resolve(true);
		})
	}

	private addMeta = <T>(snap: firebase.firestore.QueryDocumentSnapshot<T>) =>
		({ ...snap.data(), [FIELD.Id]: snap.id } as T)

	/**
	 * determine the Collection associated with a Store.  
	 * update the Query to include the Store
	 */
	private storeQuery(store: COLLECTION | STORE, query: fire.Query) {
		const collection = getSlice(store);

		if (!isCollection(store)) {									// make sure 'store' is in where-criteria
			query.where = asArray(query.where);
			asArray(query.where).push(fire.addWhere(FIELD.Store, store));
		}

		return collection;
	}

	/**
	 * setup an onSnapshot listener to a FireStore query
	 */
	listen<T, K extends boolean = false>(store: COLLECTION | STORE, query?: fire.Query, state?: K): Observable<T[]>;
	listen<T, K extends boolean = true>(store: COLLECTION | STORE, query?: fire.Query, state?: K): Observable<fire.FireSnap<T>[]>;
	listen<T>(store: COLLECTION | STORE, query: fire.Query = {}, state = false) {
		const collection = this.storeQuery(store, query);
		let offSnapshot: firebase.Unsubscribe;			// method to disconnect the Snapshot listener

		return new Observable(observer => {
			offSnapshot = this.collectionReference<T>(collection, query)
				.onSnapshot(snap =>
					observer.next(
						state																// report back as 'FireSnap' object or a 'document' array
							? snap.docChanges().map(change => ({ type: change.type, metadata: cloneObj(change.doc.metadata), doc: this.addMeta(change.doc) } as fire.FireSnap<T>))
							: snap.docs.map(this.addMeta)
					),
					observer.error,												// snapshot failed
					observer.complete											// snapshot completed itself (ie no more data)
				)
		}).pipe(
			finalize(() => offSnapshot?.())						// when unsubscribe Observable, complete the onShapshot listener
		)
	}

	select<T>(store: COLLECTION | STORE, query: fire.Query = {}) {
		const collection = this.storeQuery(store, query);

		return this.collectionReference<T>(collection, query)
			.get()
			.then(snap => snap.docs.map(doc => ({ ...doc.data(), [FIELD.Id]: doc.id } as unknown as T)))
	}

	insert(data: FireDocument) {
		const docId = data[FIELD.Id] || this.newId(data[FIELD.Store]);

		data = this.removeMeta(data);								// remove the meta-fields from the document
		return this.documentReference(data).set(data)
			.then(() => docId);
	}

	update(data: FireDocument) {
		const docId = data[FIELD.Id];

		data = this.removeMeta(data);
		return this.documentReference(data).update(data)
	}

	delete(data: FireDocument) {
		return this.documentReference(data).delete();
	}

	callMeta(store: STORE, docId: string) {
		return this.http<fire.DocMeta>('readMeta', { collection: getSlice(store), [FIELD.Id]: docId }, `checking ${store}`);
	}

	/** This helps an Admin impersonate another Member */
	createToken(uid: string) {
		return this.http<string>('createToken', { uid }, `creating token for ${uid}`);
	}

	/** Useful when Member is already authenticated elsewhere (eg. helloJS) */
	authToken(access_token: string, user: firebase.UserInfo) {
		return this.http<string>('authToken', { access_token, ...user }, `creating token for ${user.uid}`);
	}

	/** Call a server Cloud Function */
	private http<T>(fnName: string, args: Object, msg?: string) {
		const fn = this.#functions.httpsCallable(fnName);
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
