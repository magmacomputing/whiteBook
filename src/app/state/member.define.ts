import { FIELD } from '@dbase/fire/fire.define';

/**
 * The 'member' state contains a copy of the remote /member Collection,
 * separated into distinct 'store' objects.
 * For example:
 * member: {
 * 		profile: [ {profile documents} ],
 *  	message: [ {message documents} ],
 * 		...
 * 	}
 */

export interface IMemberDoc {
	[FIELD.id]: string;
	store: string;
	[key: string]: any;
}
export interface IMemberState {
	[store: string]: IMemberDoc[];
}

/** Actions */
export class SetMember {											// Add a Member object into the Store
	static type = '[Sync Service] Set Member';
	constructor(public payload: IMemberDoc) { };
}

export class DelMember {											// Remove a Member object from the Store
	static type = '[Sync Service] Delete Member';
	constructor(public payload: IMemberDoc) { };
}

export class TruncMember {										// Truncate a Member object from the Store
	static type = '[Sync Service] Truncate Member';
}