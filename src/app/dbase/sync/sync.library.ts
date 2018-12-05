import { SnapshotMetadata } from '@firebase/firestore-types';
import { DocumentChangeAction } from '@angular/fire/firestore';

import { ROUTE } from '@route/router/route.define';
import { FIELD } from '@dbase/data/data.define';

import { IListen, StoreStorage } from '@dbase/sync/sync.define';
import { IStoreMeta, TStoreBase } from '@dbase/data/data.schema';

import { sortKeys } from '@lib/object.library';
import { cryptoHash } from '@lib/crypto.library';

export const getSource = (snaps: DocumentChangeAction<IStoreMeta>[]) => {
	const meta = snaps.length ? snaps[0].payload.doc.metadata : {} as SnapshotMetadata;
	return meta.fromCache
		? 'cache'
		: meta.hasPendingWrites
			? 'local'
			: 'server'
}

/** check for tampering on the localStorage object */
export const checkStorage = async (listen: IListen, snaps: DocumentChangeAction<IStoreMeta>[]) => {
	const localState = JSON.parse(window.localStorage.getItem(StoreStorage) || '{}');
	const localSlice = localState[listen.slice] || {};
	const localList: IStoreMeta[] = [];
	const snapList = snaps.map(buildDoc);

	Object.keys(localSlice).forEach(key => localList.push(...localSlice[key]));
	const localSort = localList.sort(sortKeys(FIELD.store, FIELD.id));
	const snapSort = snapList.sort(sortKeys(FIELD.store, FIELD.id));
	const [localHash, storeHash] = await Promise.all([cryptoHash(localSort), cryptoHash(snapSort),]);

	if (localHash === storeHash) {                  // compare what is in snap0 with localStorage
		listen.ready.resolve(true);                   // indicate snap0 is ready
		return true;                                  // ok, already sync'd
	}

	this.dbg('hash: %s / %s', localHash, storeHash);
	this.dbg('local: %j', localSort);
	this.dbg('store: %j', snapSort);
	return false;
}

export const buildDoc = (snap: DocumentChangeAction<IStoreMeta>) =>
	({
		[FIELD.id]: snap.payload.doc.id,
		...snap.payload.doc.data()
	}) as TStoreBase