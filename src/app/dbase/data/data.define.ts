import { IObject } from '@lib/object.library';

export const enum COLLECTION {			// collection starts with upper-case, document with lower-case
	Log = 'log',
	Register = 'register',
	Member = 'member',
	Attend = 'attend',
	Client = 'client',
	Admin = 'admin',
}

export const STORES: { [col: string]: string[] } = {
	auth: ['userInfo', 'userToken'],
	client: ['class', 'event', 'provider', 'price', 'plan', 'schedule', 'location', 'instructor', '_default_', '_config_', '_schema_'],
	member: ['account', 'profile'],
	attend: ['attend'],
}

export const enum STORE {
	profile = 'profile',
	account = 'account',
	attend = 'attend',
	provider = 'provider',
	class = 'class',
	event = 'event',
	price = 'price',
	plan = 'plan',
	schedule = 'schedule',
	calendar = 'calendar',
	location = 'location',
	instructor = 'instructor',
	default = '_default_',
	config = '_config_',
}

export const enum FIELD {					// common Field names
	effect = '_effect',							// valid when greater-than-or-equal-to
	expire = '_expire',							// valid when less-than
	update = '_update',							// date-time modified
	create = '_create',							// date-time created
	access = '_access',							// date-time accessed
	hidden = '_hidden',							// valid, but not displayed to User
	disable = '_disable',						// displayed, but greyed to User
	id = '_id',
	uid = 'uid',
	store = 'store',
	type = 'type',
	key = 'key',
};

/** a list of Fields on which to Filter Documents, when determining Type-2 delta-inserts */
export const FILTER: IObject<string[]> = {
	[COLLECTION.Client]: [FIELD.store, FIELD.key],
	[COLLECTION.Member]: [FIELD.store, FIELD.type, FIELD.key],
	[COLLECTION.Attend]: [FIELD.store, FIELD.type, FIELD.key],
}

export const SORTBY: IObject<string[]> = {
	[STORE.plan]: ['sort', FIELD.key],
	[STORE.schedule]: ['day', 'start'],
}