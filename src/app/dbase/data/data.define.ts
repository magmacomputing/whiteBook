import { IObject } from "@lib/object.library";

export const COLLECTION = {			// collection starts with upper-case, document with lower-case
	Log: 'log',
	Register: 'register',
	Member: 'member',
	Attend: 'attend',
	Client: 'client',
}

export const STORE = {
	profile: 'profile',
	account: 'account',
	attend: 'attend',
	provider: 'provider',
	class: 'class',
	price: 'price',
	schedule: 'schedule',
}

export const enum FIELD {					//  common Field names
	effect = '_effect',
	expire = '_expire',
	modify = '_modify',
	hidden = '_hidden',
	disable = '_disable',
	id = '_id',
	uid = 'uid',
	key = '_key',
	store = 'store',
	type = 'type',
	memberId = 'memberId'
};

/** a list of Fields on which to Filter Documents, when determining Type-2 delta-inserts */
export const FILTER: IObject<string[]> = {
	[COLLECTION.Client]: [FIELD.store],
	[COLLECTION.Member]: [FIELD.store, FIELD.type, FIELD.uid],
	[COLLECTION.Attend]: [FIELD.store, FIELD.type, FIELD.uid],
}