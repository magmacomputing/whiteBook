import { TWhere } from '@dbase/fire/fire.interface';
import { TString } from '@lib/type.library';
import { IStoreMeta } from '@dbase/data/data.schema';

export enum SLICE {
	root = 'root',
	client = 'client',
	auth = 'auth',
	member = 'member',
	attend = 'attend',
	admin = 'admin',
	local = 'local',
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
 *      payment: [ {payment documents} ],   // describe payments
 *  },
 * attend: {																// Attend slice, keyed by User.uid
 *      {paymentId}: [ {attendance documents} ],// hold a number of Attendances against a particular account-payment
 *  }
 */

export interface ISelector<T> {
	(store: string, filter: TWhere | undefined, keys: TString): T[];
}

export type TStateSlice<T> = { [store: string]: T[] };

/** Actions */
export class SetClient {										// Add a Client object into the Store
	static type = '[Sync Service] Set Client';
	constructor(public payload: IStoreMeta, public debug: boolean = true) { }
}

export class DelClient {									    // Remove a Client object from the Store
	static type = '[Sync Service] Delete Client';
	constructor(public payload: IStoreMeta, public debug: boolean = true) { }
}

export class TruncClient {										// Truncate a Client object from the Store
	static type = '[Sync Service] Truncate Client';
	constructor(public debug: boolean = true) { }
}

export class SetLocal {											// Add a Client object-clone into the local Store
	static type = '[Sync Service] Set Local';
	constructor(public payload: IStoreMeta, public debug: boolean = true) { }
}

export class DelLocal {
	static type = '[Sync Service] Delete Local';
	constructor(public payload: IStoreMeta, public debug: boolean = true) { }
}

export class TruncLocal {
	static type = '[Sync Service] Truncate Local';
	constructor(public debug: boolean = true) { }
}

export class SetMember {										// Add a Member object into the Store
	static type = '[Sync Service] Set Member';
	constructor(public payload: IStoreMeta, public debug: boolean = true) { }
}

export class DelMember {										// Remove a Member object from the Store
	static type = '[Sync Service] Delete Member';
	constructor(public payload: IStoreMeta, public debug: boolean = true) { }
}

export class TruncMember {									// Truncate a Member object from the Store
	static type = '[Sync Service] Truncate Member';
	constructor(public debug: boolean = true) { }
}

export class SetAttend {										// Add Attend object into the Store
	static type = '[Sync Service] Set Attend';
	constructor(public payload: IStoreMeta, public debug: boolean = true) { }
}

export class DelAttend {										// Remove Attend object from the Store
	static type = '[Sync Service] Delete Attend';
	constructor(public payload: IStoreMeta, public debug: boolean = true) { }
}

export class TruncAttend {									// Truncate Attend object from the Store
	static type = '[Sync Service] Truncate Attend';
	constructor(public debug: boolean = true) { }
}