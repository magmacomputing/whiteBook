import { FIELD } from '@dbase/fire/fire.define';
import { IStoreDoc } from '@state/store.define';

/**
 * States of type 'client' contain a copy of remote /client documents,
 * separated into distinct 'store' objects.
 * For example:
 * client: {
 * 		class: [ {class documents} ],
 *  	price: [ {price documents} ],
 * 		...
 * 	}
 */

// export interface IClientDoc {
// 	store: string;
// 	[FIELD.id]: string;
// 	[key: string]: any;
// }

/** Actions */
export class SetClient {											// Add a Client object into the Store
	static type = '[Sync Service] Set Client';
	constructor(public payload: IStoreDoc) { };
}

export class DelClient {											// Remove a Client object from the Store
	static type = '[Sync Service] Delete Client';
	constructor(public payload: IStoreDoc) { };
}

export class TruncClient {										// Truncate a Client object from the Store
	static type = '[Sync Service] Truncate Client';
}