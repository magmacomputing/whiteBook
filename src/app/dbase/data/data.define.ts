import { IObject } from "@lib/object.library";
import { TStore } from "@dbase/data/data.interface";

export const COLLECTION = {			// collection starts with upper-case, document with lower-case
	Log: 'log',
	Register: 'register',
	Member: 'member',
	Attend: 'attend',
	Client: 'client',
}

export const STORE: IObject<TStore> = {
	profile: 'profile',
	attend: 'attend',
	provider: 'provider',
	class: 'class',
	event: 'event',
	price: 'price',
	plan: 'plan',
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
	store = 'store',
	type = 'type',
	key = 'key',
	memberId = 'memberId'
};

/** a list of Fields on which to Filter Documents, when determining Type-2 delta-inserts */
export const FILTER: IObject<string[]> = {
	[COLLECTION.Client]: [FIELD.store],
	[COLLECTION.Member]: [FIELD.store, FIELD.type, FIELD.uid],
	[COLLECTION.Attend]: [FIELD.store, FIELD.type, FIELD.uid],
}