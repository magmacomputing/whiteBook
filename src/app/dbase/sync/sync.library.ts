import { firestore } from 'firebase/app';
import { DocumentChangeAction } from '@angular/fire/firestore';

import { FireService } from '@dbase/fire/fire.service';
import { FIELD, COLLECTION } from '@dbase/data/data.define';
import { IStoreMeta, TStoreBase } from '@dbase/data/data.schema';
import { IListen, StoreStorage } from '@dbase/sync/sync.define';

import { LState } from '@dbase/state/state.define';
import { Client, Member, Attend, Admin, Device } from '@dbase/state/state.action';

import { cryptoHash } from '@library/crypto.library';
import { sortKeys } from '@library/object.library';
import { getLocalStore } from '@library/browser.library';
import { lprintf } from '@library/logger.library';

export const getSource = (snaps: DocumentChangeAction<IStoreMeta>[]) => {
	const meta = snaps.length ? snaps[0].payload.doc.metadata : {} as firestore.SnapshotMetadata;
	return meta.fromCache
		? 'cache'
		: meta.hasPendingWrites
			? 'local'
			: 'server'
}

/** check for uncollected changes on remote database, or tampering on the localStorage object */
export const checkStorage = async (listen: IListen, snaps: DocumentChangeAction<IStoreMeta>[]) => {
	const localState = getLocalStore<LState>(StoreStorage) || {};
	const localSlice = localState[listen.key.collection] || {};
	const localList: IStoreMeta[] = [];
	const snapList = snaps.map(addMeta);

	Object.entries(localSlice).forEach(([_key, value]) => localList.push(...value.map(remMeta)));
	const localSort = localList.sort(sortKeys(FIELD.store, FIELD.id));
	const snapSort = snapList.sort(sortKeys(FIELD.store, FIELD.id));
	const [localHash, storeHash] = await Promise.all([
		cryptoHash(localSort),
		cryptoHash(snapSort),
	]);

	if (localHash === storeHash) {                  // compare what is in snap0 with localStorage
		listen.ready.resolve(true);                   // indicate snap0 is ready
		return true;                                  // ok, already sync'd
	}

	lprintf('SyncLibrary', '%s: %s / %s', listen.key.collection, localHash, storeHash);
	return false;
}

// TODO: call to meta introduces an unacceptable delay (for payback at this time)
export const buildDoc = async (snap: DocumentChangeAction<IStoreMeta>, fire: FireService) => {//FireService) => {
	const meta = await fire.callMeta(snap.payload.doc.get(FIELD.store), snap.payload.doc.id);
	return {
		...snap.payload.doc.data(),
		[FIELD.id]: meta[FIELD.id],
		[FIELD.create]: meta[FIELD.create],
		[FIELD.update]: meta[FIELD.update],
		[FIELD.access]: meta[FIELD.access],
	} as TStoreBase
}

/** These fields do not exist in the snapshot data() */
const remMeta = (doc: IStoreMeta) => {
	const { [FIELD.create]: c, [FIELD.update]: u, [FIELD.access]: a, ...rest } = doc;
	return rest;
}
export const addMeta = (snap: DocumentChangeAction<IStoreMeta>) =>
	({ ...snap.payload.doc.data(), [FIELD.id]: snap.payload.doc.id } as IStoreMeta)

/** Determine the ActionHandler based on the Slice listener */
export const getMethod = (slice: COLLECTION) => {
	switch (slice) {                           				// TODO: can we merge these?
		case COLLECTION.client:
			return { setStore: Client.Set, delStore: Client.Del, truncStore: Client.Trunc }

		case COLLECTION.member:
			return { setStore: Member.Set, delStore: Member.Del, truncStore: Member.Trunc }

		case COLLECTION.attend:
			return { setStore: Attend.Set, delStore: Attend.Del, truncStore: Attend.Trunc }

		case COLLECTION.device:
			return { setStore: Device.Set, delStore: Device.Del, truncStore: Device.Trunc }

		case COLLECTION.admin:
			return { setStore: Admin.Set, delStore: Admin.Del, truncStore: Admin.Trunc }

		default:
			console.log('snap: Unexpected slice: ', slice);
			throw (new Error(`snap: Unexpected slice: ${slice}`));
	}
}
