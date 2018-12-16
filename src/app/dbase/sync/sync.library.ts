import { SnapshotMetadata } from '@firebase/firestore-types';
import { DocumentChangeAction } from '@angular/fire/firestore';

import { FIELD } from '@dbase/data/data.define';

import { IListen, StoreStorage } from '@dbase/sync/sync.define';
import { IStoreMeta, TStoreBase } from '@dbase/data/data.schema';

import { sortKeys, parseObj } from '@lib/object.library';
import { cryptoHash } from '@lib/crypto.library';
import { FireService } from '@dbase/fire/fire.service';

import { fmtLog } from '@lib/logger.library';
import { getLocalStore } from '@lib/window.library';

export const getSource = (snaps: DocumentChangeAction<IStoreMeta>[]) => {
	const meta = snaps.length ? snaps[0].payload.doc.metadata : {} as SnapshotMetadata;
	return meta.fromCache
		? 'cache'
		: meta.hasPendingWrites
			? 'local'
			: 'server'
}

/** check for tampering on the localStorage object */
export const checkStorage = async (listen: IListen, snaps: DocumentChangeAction<IStoreMeta>[], debug: boolean) => {
	const localState = parseObj<any>(getLocalStore(StoreStorage) );
	const localSlice = localState[listen.slice] || {};
	const localList: IStoreMeta[] = [];
	const snapList = snaps.map(addMeta);

	Object.keys(localSlice).forEach(key => localList.push(...localSlice[key].map(remMeta)));
	const localSort = localList.sort(sortKeys(FIELD.store, FIELD.id));
	const snapSort = snapList.sort(sortKeys(FIELD.store, FIELD.id));
	const [localHash, storeHash] = await Promise.all([cryptoHash(localSort), cryptoHash(snapSort),]);

	if (localHash === storeHash) {                  // compare what is in snap0 with localStorage
		listen.ready.resolve(true);                   // indicate snap0 is ready
		return true;                                  // ok, already sync'd
	}

	if (debug) {
		fmtLog('SyncLibrary', 'hash: %s / %s', localHash, storeHash);
		fmtLog('local: %j', localSort);
		fmtLog('store: %j', snapSort);
	}
	return false;
}

// TODO: call to meta introduces an unacceptable delay (for payback at this time)
export const buildDoc = async (snap: DocumentChangeAction<IStoreMeta>, fire: FireService) => {
	// const meta = await fire.callMeta(snap.payload.doc.get(FIELD.store), snap.payload.doc.id);
	return {
		[FIELD.id]: snap.payload.doc.id,
		// [FIELD.create]: meta[FIELD.create],
		// [FIELD.update]: meta[FIELD.update],
		// [FIELD.access]: meta[FIELD.access],
		...snap.payload.doc.data()
	} as TStoreBase
}

/** These fields do not exist in the snapshot data() */
const remMeta = (doc: IStoreMeta) => {
	const { [FIELD.create]: b, [FIELD.update]: c, [FIELD.access]: d, ...rest } = doc;
	return rest;
}
export const addMeta = (snap: DocumentChangeAction<IStoreMeta>) =>
	Object.assign({ [FIELD.id]: snap.payload.doc.id }, snap.payload.doc.data());
