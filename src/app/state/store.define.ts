import { FIELD } from '@dbase/fire/fire.define';

/**
 * States of type 'store' contain a copy of remote Collection documents,
 * separated into distinct 'store' objects.
 * For example:
 * client: {
 * 		class: [ {class documents} ],
 *  	price: [ {price documents} ],
 * 		...
 * 	}
 */

export interface IStoreDoc {
	[FIELD.id]: string;
	store: string;
	[key: string]: any;
}
export interface IStoreState {
	[store: string]: IStoreDoc[];
}

/** Actions */
export class SetStore {											// Add a Store object into the Store
	static type = '[Sync Service] Set Store';
	constructor(public payload: IStoreDoc) { };
}

export class DelStore {											// Remove a Store object from the Store
	static type = '[Sync Service] Delete Store';
	constructor(public payload: IStoreDoc) { };
}

export class TruncStore {										// Truncate a Store object from the Store
	static type = '[Sync Service] Truncate Store';
}