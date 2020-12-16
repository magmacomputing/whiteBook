import firebase from 'firebase/app';
import type { DocumentChangeAction } from '@angular/fire/firestore';

import { FIELD, COLLECTION } from '@dbase/data.define';
import type { FireDocument } from '@dbase/data.schema';
import type { sync } from '@dbase/sync/sync.define';

import type { LState } from '@dbase/state/state.define';
import { clientAction, memberAction, attendAction, adminAction, deviceAction, stageAction } from '@dbase/state/state.action';

import { Cipher } from '@library/cipher.library';
import { WebStore } from '@library/browser.library';
import { lprintf } from '@library/logger.library';

export const getSource = (snaps: DocumentChangeAction<FireDocument>[]) => {
	const meta = snaps.length ? snaps[0].payload.doc.metadata : {} as firebase.firestore.SnapshotMetadata;
	return meta.fromCache
		? 'cache'
		: meta.hasPendingWrites
			? 'local'
			: 'server'
}

/** check for uncollected changes on remote database, or tampering on the localStorage object */
export const checkStorage = async (listen: sync.Listen, snaps: DocumentChangeAction<FireDocument>[]) => {
	const localState = WebStore.local.get<LState>(WebStore.State, {});
	const localSlice = localState[listen.key.collection] || {};
	const localList: FireDocument[] = [];
	const snapList = snaps.map(addMeta);

	Object.entries(localSlice).forEach(([_key, value]) => localList.push(...value.map(remMeta)));
	const localSort = localList.sortBy(FIELD.Store, FIELD.Id);
	const snapSort = snapList.sortBy(FIELD.Store, FIELD.Id);
	const [localHash, storeHash] = await Promise.all([
		Cipher.hash(localSort),
		Cipher.hash(snapSort),
	]);

	if (localHash === storeHash) {                  // compare what is in snap0 with localStorage
		listen.ready.resolve(true);                   // indicate snap0 is ready
		return true;                                  // ok, already sync'd
	}

	lprintf('SyncLibrary', '%s: %s / %s', listen.key.collection, localHash.slice(-7), storeHash.slice(-7));
	return false;
}

/** These fields do not exist in the snapshot data() */
const remMeta = (doc: FireDocument) => {
	const { [FIELD.Create]: c, [FIELD.Update]: u, [FIELD.Access]: a, ...rest } = doc;
	return rest;
}

export const addMeta = (snap: DocumentChangeAction<FireDocument>) =>
	({ ...snap.payload.doc.data(), [FIELD.Id]: snap.payload.doc.id } as FireDocument)

/** Determine the ActionHandler based on the Slice listener */
export const getMethod = (slice: COLLECTION) => {
	switch (slice) {                           				// TODO: can we merge these?
		case COLLECTION.Client:
			return { setStore: clientAction.Set, delStore: clientAction.Del, clearStore: clientAction.Clear }

		case COLLECTION.Member:
			return { setStore: memberAction.Set, delStore: memberAction.Del, clearStore: memberAction.Clear }

		case COLLECTION.Attend:
			return { setStore: attendAction.Set, delStore: attendAction.Del, clearStore: attendAction.Clear }

		case COLLECTION.Device:
			return { setStore: deviceAction.Set, delStore: deviceAction.Del, clearStore: deviceAction.Clear }

		case COLLECTION.Admin:
			return { setStore: adminAction.Set, delStore: adminAction.Del, clearStore: adminAction.Clear }

		case COLLECTION.Stage:
			return { setStore: stageAction.Set, delStore: stageAction.Del, clearStore: stageAction.Clear }

		default:
			console.log('snap: Unexpected slice: ', slice);
			throw (new Error(`snap: Unexpected slice: ${slice}`));
	}
}
