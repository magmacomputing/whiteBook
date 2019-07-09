import * as firebase from 'firebase/app';
import { DocumentChangeAction } from '@angular/fire/firestore';

import { FIELD } from '@dbase/data/data.define';
import { IStoreMeta, TStoreBase } from '@dbase/data/data.schema';
import { IListen, StoreStorage } from '@dbase/sync/sync.define';

import { SLICE, LState } from '@dbase/state/state.define';
import { SetDevice, DelDevice, TruncDevice, SetAdmin, DelAdmin, TruncAdmin } from '@dbase/state/state.action';
import { SetClient, DelClient, TruncClient } from '@dbase/state/state.action';
import { SetMember, DelMember, TruncMember } from '@dbase/state/state.action';
import { SetAttend, DelAttend, TruncAttend } from '@dbase/state/state.action';

import { cryptoHash } from '@lib/crypto.library';
import { sortKeys } from '@lib/object.library';
import { getLocalStore } from '@lib/window.library';
import { lprintf } from '@lib/logger.library';

export const getSource = (snaps: DocumentChangeAction<IStoreMeta>[]) => {
	const meta = snaps.length ? snaps[0].payload.doc.metadata : {} as firebase.firestore.SnapshotMetadata;
	return meta.fromCache
		? 'cache'
		: meta.hasPendingWrites
			? 'local'
			: 'server'
}

/** check for uncollected changes on remote database, or tampering on the localStorage object */
export const checkStorage = async (listen: IListen, snaps: DocumentChangeAction<IStoreMeta>[]) => {
	const localState = getLocalStore<LState>(StoreStorage) || {};
	const localSlice = localState[listen.collection] || {};
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

	lprintf('SyncLibrary', '%s: %s / %s', listen.collection, localHash, storeHash);
	return false;
}

// TODO: call to meta introduces an unacceptable delay (for payback at this time)
export const buildDoc = async (snap: DocumentChangeAction<IStoreMeta>, fire?: any) => {//FireService) => {
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
	const { [FIELD.create]: c, [FIELD.update]: u, [FIELD.access]: a, ...rest } = doc;
	return rest;
}
export const addMeta = (snap: DocumentChangeAction<IStoreMeta>) =>
	({ [FIELD.id]: snap.payload.doc.id, ...snap.payload.doc.data() } as IStoreMeta)

/** Determine the ActionHandler based on the Slice listener */
export const getMethod = (slice: string) => {
	switch (slice) {                           				// TODO: can we merge these?
		case SLICE.client:
			return { setStore: SetClient, delStore: DelClient, truncStore: TruncClient }

		case SLICE.member:
			return { setStore: SetMember, delStore: DelMember, truncStore: TruncMember }

		case SLICE.attend:
			return { setStore: SetAttend, delStore: DelAttend, truncStore: TruncAttend }

		case SLICE.device:
			return { setStore: SetDevice, delStore: DelDevice, truncStore: TruncDevice }

		case SLICE.admin:
			return { setStore: SetAdmin, delStore: DelAdmin, truncStore: TruncAdmin }

		default:
			console.log('snap: Unexpected slice: ', slice);
			throw (new Error(`snap: Unexpected slice: ${slice}`));
	}
}
