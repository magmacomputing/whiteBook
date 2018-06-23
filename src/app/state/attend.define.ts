import { IStoreDoc } from '@state/store.define';

/**
 * The 'attend' state contains a copy of the remote /attend Collection,
 * separated into distinct 'payment' IDs.
 * For example:
 * attend: {
 * 		payment1: [ {attend documents} ],
 *  	payment2: [ {attend documents} ],
 * 		...
 * 	}
 */

/** Actions */
export class SetAttend {											// Add Attend object into the Store
	static type = '[Sync Service] Set Attend';
	constructor(public payload: IStoreDoc) { }
}

export class DelAttend {											// Remove Attend object from the Store
	static type = '[Sync Service] Delete Attend';
	constructor(public payload: IStoreDoc) { }
}

export class TruncAttend {										// Truncate Attend object from the Store
	static type = '[Sync Service] Truncate Attend';
}