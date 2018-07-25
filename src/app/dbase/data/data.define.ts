import { IObject } from "@lib/object.library";
import { TStore } from "@dbase/data/data.interface";

export const COLLECTION = {			// collection starts with upper-case, document with lower-case
	Log: 'log',
	Register: 'register',
	Member: 'member',
	Attend: 'attend',
	Client: 'client',
	Admin: 'admin',
}

export const STORES: { [col: string]: string[] } = {
	client: ['class', 'event', 'provider', 'price', 'plan', 'schedule', 'location', 'instructor', '_default_'],
	member: ['profile', 'account'],
	attend: [],
}

export const STORE: IObject<TStore> = {
	profile: 'profile',
	account: 'account',
	provider: 'provider',
	class: 'class',
	event: 'event',
	price: 'price',
	plan: 'plan',
	schedule: 'schedule',
	location: 'location',
	instructor: 'instructor',
}

export const enum FIELD {					//  common Field names
	effect = '_effect',
	expire = '_expire',
	update = '_update',							// date-time modified
	create = '_create',							// date-time created
	access = '_access',							// date-time accessed
	hidden = '_hidden',
	disable = '_disable',
	id = '_id',
	store = 'store',
	type = 'type',
	key = 'key',
	uid = 'uid',
	memberId = 'memberId'
};

/** a list of Fields on which to Filter Documents, when determining Type-2 delta-inserts */
export const FILTER: IObject<string[]> = {
	[COLLECTION.Client]: [FIELD.store, FIELD.key],
	[COLLECTION.Member]: [FIELD.store, FIELD.type, FIELD.key],
	[COLLECTION.Attend]: [FIELD.store, FIELD.type, FIELD.key],
}