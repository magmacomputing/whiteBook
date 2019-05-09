import { IObject } from '@lib/object.library';
import { TString } from '@lib/type.library';

export enum COLLECTION {
	log = 'log',
	member = 'member',
	attend = 'attend',
	client = 'client',
	admin = 'admin',
	local = '_local_',
}

export enum STORE {
	profile = 'profile',
	payment = 'payment',
	attend = 'attend',
	provider = 'provider',
	alert = 'alert',
	class = 'class',
	event = 'event',
	price = 'price',
	plan = 'plan',
	schedule = 'schedule',
	calendar = 'calendar',
	location = 'location',
	instructor = 'instructor',
	message = 'message',
	bonus = 'bonus',
	gift = 'gift',
	span = 'span',
	default = '_default_',
	config = '_config_',
	schema = '_schema_',
	register = 'register',
	account = 'account',
	migrate = 'migrate',
	local = '_local_',
	log = 'log',
}

export enum MEMBER {
	profile = 'profile',
	payment = 'payment',
	diary = 'diary',
	gift = 'gift',
}

// export enum LOCAL {
// 	config = '@config@',
// }

export enum FIELD {								// common Field names
	effect = '_effect',							// valid when greater-than-or-equal-to
	expire = '_expire',							// valid when less-than
	update = '_update',							// date-time modified
	create = '_create',							// date-time created
	access = '_access',							// date-time accessed
	hidden = '_hidden',							// valid, but not displayed to User
	disable = '_disable',						// displayed, but greyed to User
	stamp = 'stamp',
	note = 'note',
	date = 'date',
	id = '_id',
	uid = 'uid',
	store = 'store',
	type = 'type',
	icon = 'icon',
	key = 'key',
};

export const enumKey = (e: any, value: string) => Object.keys(e).find(row => e[row] === value) || 'unknown';

/** These variables are built in ClientState initial snapshot */
export let SLICES: IObject<string[]> = {};

/** a list of Fields on which to Filter Documents, when determining Type-2 delta-inserts */
export let FILTER: IObject<TString> = {
	[COLLECTION.client]: [FIELD.store, FIELD.key],
	[COLLECTION.member]: [FIELD.store, FIELD.type, FIELD.uid],
	[COLLECTION.attend]: [FIELD.store, FIELD.type, FIELD.uid],
}

export let SORTBY: IObject<TString> = {};