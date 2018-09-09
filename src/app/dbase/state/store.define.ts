import { FIELD } from '@dbase/data.define';
import { TWhere } from '@dbase/fire.interface';

export enum SLICE {
	root = 'root',
	client = 'client',
	auth = 'auth',
	router = 'router',
	member = 'member',
	attend = 'attend',
}

/**
 * State contains a copy of remote documents, separated into distinct 'store' objects.
 * For example:
 * client: {                                // Client slice, holds public data
 * 		class: [ {class documents} ],       	// Class store, holds documents that describe classes
 *  	price: [ {price documents} ],      		// Price store, holds documents that describe pricing structure
 * 		...
 * 	},
 * member: {																// Member slice, keyed by User.uid
 *      profile: [ {profile documents} ],   // Plan, Claims, User, etc.
 *      account: [ {account documents} ],   // describe payments
 *  },
 * attend: {																// Attend slice, keyed by User.uid
 *      {accountId}: [ {attendance documents} ],// hold a number of Attendances against a particular account-payment
 *  }
 */
export interface IStoreDoc {
	[FIELD.id]: string;
	[FIELD.store]: string;
	[FIELD.type]?: string;
	[FIELD.key]: string;
	[key: string]: any;
}

export interface ISelector<T> {
	(store: string, filter: TWhere | undefined, keys: string | string[]): T[];
}

export type IStoreState<T> = { [store: string]: T[] };

/** Actions */
export class SetClient {										// Add a Client object into the Store
	static type = '[Sync Service] Set Client';
	constructor(public payload: IStoreDoc, public debug: boolean) { };
}

export class DelClient {									    // Remove a Client object from the Store
	static type = '[Sync Service] Delete Client';
	constructor(public payload: IStoreDoc, public debug: boolean) { };
}

export class TruncClient {										// Truncate a Client object from the Store
	static type = '[Sync Service] Truncate Client';
}

export class SetMember {										// Add a Member object into the Store
	static type = '[Sync Service] Set Member';
	constructor(public payload: IStoreDoc, public debug: boolean) { };
}

export class DelMember {										// Remove a Member object from the Store
	static type = '[Sync Service] Delete Member';
	constructor(public payload: IStoreDoc, public debug: boolean) { };
}

export class TruncMember {										// Truncate a Member object from the Store
	static type = '[Sync Service] Truncate Member';
}

export class SetAttend {										// Add Attend object into the Store
	static type = '[Sync Service] Set Attend';
	constructor(public payload: IStoreDoc, public debug: boolean) { }
}

export class DelAttend {										// Remove Attend object from the Store
	static type = '[Sync Service] Delete Attend';
	constructor(public payload: IStoreDoc, public debug: boolean) { }
}

export class TruncAttend {										// Truncate Attend object from the Store
	static type = '[Sync Service] Truncate Attend';
}