import { FIELD } from '@dbase/fire/fire.define';

/**
 * The 'client' state contains a copy of the remote /client Collection,
 * separated into distinct 'store' objects.
 * For example:
 * client: {
 * 		class: [ {class documents} ],
 *  	price: [ {price documents} ],
 * 		...
 * 	}
 */

export interface IClientDoc {
	[FIELD.id]: string;
	store: string;
	[key: string]: any;
}
export interface IClientState {
	[store: string]: IClientDoc[];
}

/** Actions */
export class SetClient {											// Add a Client object into the Store
	static type = '[Sync Service] Set Client';
	constructor(public payload: IClientDoc) { };
}

export class DelClient {											// Remove a Client object from the Store
	static type = '[Sync Service] Delete Client';
	constructor(public payload: IClientDoc) { };
}

export class TruncClient {										// Truncate a Client object from the Store
	static type = '[Sync Service] Truncate Client';
}