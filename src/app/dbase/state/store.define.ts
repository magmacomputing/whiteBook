import { FIELD } from '@dbase/data/data.define';
import { IWhere } from '@dbase/fire/fire.interface';
import { IObject } from '@lib/object.library';

export enum SLICE  {
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
 * client: {                                // Client State, holds public data
 * 		class: [ {class documents} ],       	// Class store, holds documents that describe classes
 *  	price: [ {price documents} ],      		// Price store, holds documents that describe pricing structure
 * 		...
 * 	},
 * member: {
 *      profile: [ {profile documents} ],   // Plan, Claims, User, etc.
 *      account: [ {account documents} ],   // describe payments
 *  },
 * attend: {
 *      {payId}: [ {attendance documents} ],// hold a number of Attendances against a particular payment
 *  }
 */
export interface IStoreDoc {
	[FIELD.id]: string;
	[FIELD.store]: string;
	[key: string]: any;
}

export interface ISelector<T> {
	(store: string, filter: IWhere | IWhere[] | undefined, keys: string | string[]): T[];
}

export type IStoreState = {[store: string]: IStoreDoc[]};

/** Actions */
export class SetClient {										// Add a Client object into the Store
	static type = '[Sync Service] Set Client';
	constructor(public payload: IStoreDoc) { };
}

export class DelClient {									    // Remove a Client object from the Store
	static type = '[Sync Service] Delete Client';
	constructor(public payload: IStoreDoc) { };
}

export class TruncClient {										// Truncate a Client object from the Store
	static type = '[Sync Service] Truncate Client';
}

export class SetMember {										// Add a Member object into the Store
	static type = '[Sync Service] Set Member';
	constructor(public payload: IStoreDoc) { };
}

export class DelMember {										// Remove a Member object from the Store
	static type = '[Sync Service] Delete Member';
	constructor(public payload: IStoreDoc) { };
}

export class TruncMember {										// Truncate a Member object from the Store
	static type = '[Sync Service] Truncate Member';
}

export class SetAttend {										// Add Attend object into the Store
	static type = '[Sync Service] Set Attend';
	constructor(public payload: IStoreDoc) { }
}

export class DelAttend {										// Remove Attend object from the Store
	static type = '[Sync Service] Delete Attend';
	constructor(public payload: IStoreDoc) { }
}

export class TruncAttend {										// Truncate Attend object from the Store
	static type = '[Sync Service] Truncate Attend';
}