import { IObject } from '@lib/object.library';
import { TString } from '@lib/type.library';

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
	client: ['class', 'calendar', 'event', 'provider', 'price', 'plan', 'schedule', 'location', 'instructor', 'diary', '_default_', '_config_', '_schema_'],
	member: ['payment', 'profile'],
	attend: ['attend'],
}

export const enum STORE {
	profile = 'profile',
	payment = 'payment',
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
	diary = 'diary',
	default = '_default_',
	config = '_config_',
	schema = '_schema_',
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
	icon = 'icon',
	key = 'key',
};

/** a list of Fields on which to Filter Documents, when determining Type-2 delta-inserts */
export const FILTER: IObject<string[]> = {
	[COLLECTION.Client]: [FIELD.store, FIELD.key],
	[COLLECTION.Member]: [FIELD.store, FIELD.type, FIELD.uid],
	[COLLECTION.Attend]: [FIELD.store, FIELD.type, FIELD.uid],
}

export const SORTBY: IObject<TString> = {
	[STORE.provider]: ['sort', FIELD.key],
	[STORE.plan]: ['sort', FIELD.key],
	[STORE.schedule]: ['location', FIELD.type, 'day', 'start', FIELD.key],
	[STORE.calendar]: [FIELD.key, 'start'],
	[STORE.class]: FIELD.key,
	[STORE.event]: [FIELD.key, 'name'],
	[STORE.price]: [FIELD.key, FIELD.type],
	[STORE.location]: ['sort', FIELD.key],
	[STORE.instructor]: ['sort', FIELD.key],
	[STORE.default]: [FIELD.type, FIELD.key],
	[STORE.schema]: [FIELD.type, FIELD.key],
	[STORE.profile]: [FIELD.uid, FIELD.type, FIELD.effect],
	[STORE.payment]: [FIELD.uid, FIELD.type, FIELD.effect],
	[STORE.attend]: [FIELD.uid, FIELD.type, FIELD.effect],
}