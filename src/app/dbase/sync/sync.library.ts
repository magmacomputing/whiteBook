import firebase from 'firebase/app';
import { DocumentChangeAction } from '@angular/fire/firestore';

import { FireService } from '@dbase/fire/fire.service';
import { FIELD, COLLECTION } from '@dbase/data/data.define';
import { StoreMeta, TStoreBase } from '@dbase/data/data.schema';
import { Sync } from '@dbase/sync/sync.define';

import { LState } from '@dbase/state/state.define';
import { ClientAction, MemberAction, AttendAction, AdminAction, DeviceAction } from '@dbase/state/state.action';

import { cryptoHash } from '@library/crypto.library';
import { Storage } from '@library/browser.library';
import { lprintf } from '@library/logger.library';

export const getSource = (snaps: DocumentChangeAction<StoreMeta>[]) => {
	const meta = snaps.length ? snaps[0].payload.doc.metadata : {} as firebase.firestore.SnapshotMetadata;
	return meta.fromCache
		? 'cache'
		: meta.hasPendingWrites
			? 'local'
			: 'server'
}

/** check for uncollected changes on remote database, or tampering on the localStorage object */
export const checkStorage = async (listen: Sync.Listen, snaps: DocumentChangeAction<StoreMeta>[]) => {
	const localState = new Storage('local').get<LState>(Sync.storeStorage, {})
	const localSlice = localState[listen.key.collection] || {};
	const localList: StoreMeta[] = [];
	const snapList = snaps.map(addMeta);

	Object.entries(localSlice).forEach(([_key, value]) => localList.push(...value.map(remMeta)));
	const localSort = localList.sortBy(FIELD.store, FIELD.id);
	const snapSort = snapList.sortBy(FIELD.store, FIELD.id);
	const [localHash, storeHash] = await Promise.all([
		cryptoHash(localSort),
		cryptoHash(snapSort),
	]);

	if (localHash === storeHash) {                  // compare what is in snap0 with localStorage
		listen.ready.resolve(true);                   // indicate snap0 is ready
		return true;                                  // ok, already sync'd
	}

	lprintf('SyncLibrary', '%s: %s / %s', listen.key.collection, localHash.slice(-7), storeHash.slice(-7));
	return false;
}

// TODO: call to meta introduces an unacceptable delay (for payback, at this time)
export const buildDoc = async (snap: DocumentChangeAction<StoreMeta>, fire: FireService) => {//FireService) => {
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
const remMeta = (doc: StoreMeta) => {
	const { [FIELD.create]: c, [FIELD.update]: u, [FIELD.access]: a, ...rest } = doc;
	return rest;
}
export const addMeta = (snap: DocumentChangeAction<StoreMeta>) =>
	({ ...snap.payload.doc.data(), [FIELD.id]: snap.payload.doc.id } as StoreMeta)

/** Determine the ActionHandler based on the Slice listener */
export const getMethod = (slice: COLLECTION) => {
	switch (slice) {                           				// TODO: can we merge these?
		case COLLECTION.client:
			return { setStore: ClientAction.Set, delStore: ClientAction.Del, truncStore: ClientAction.Trunc }

		case COLLECTION.member:
			return { setStore: MemberAction.Set, delStore: MemberAction.Del, truncStore: MemberAction.Trunc }

		case COLLECTION.attend:
			return { setStore: AttendAction.Set, delStore: AttendAction.Del, truncStore: AttendAction.Trunc }

		case COLLECTION.device:
			return { setStore: DeviceAction.Set, delStore: DeviceAction.Del, truncStore: DeviceAction.Trunc }

		case COLLECTION.admin:
			return { setStore: AdminAction.Set, delStore: AdminAction.Del, truncStore: AdminAction.Trunc }

		default:
			console.log('snap: Unexpected slice: ', slice);
			throw (new Error(`snap: Unexpected slice: ${slice}`));
	}
}
