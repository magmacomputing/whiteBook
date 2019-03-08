import { IObject } from '@lib/object.library';
import { TString } from '@lib/type.library';

export enum COLLECTION {
	log = 'log',
	register = 'register',
	member = 'member',
	attend = 'attend',
	client = 'client',
	admin = 'admin',
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
	span = 'span',
	default = '_default_',
	config = '_config_',
	schema = '_schema_',
	log = 'log',
}

export enum MEMBER {
	profile = 'profile',
	payment = 'payment',
	diary = 'diary',
	bonus = 'bonus',
}

export enum LOCAL {
	config = '@config@',
}

export enum FIELD {								// common Field names
	effect = '_effect',							// valid when greater-than-or-equal-to
	expire = '_expire',							// valid when less-than
	update = '_update',							// date-time modified
	create = '_create',							// date-time created
	access = '_access',							// date-time accessed
	hidden = '_hidden',							// valid, but not displayed to User
	disable = '_disable',						// displayed, but greyed to User
	stamp = 'stamp',
	id = '_id',
	uid = 'uid',
	store = 'store',
	type = 'type',
	icon = 'icon',
	key = 'key',
};

/** These variables will be built in ClientState */
export let SLICES: IObject<string[]> = {
	// auth: ['credential', 'info', 'token', 'user'],
	// client: ['class', 'calendar', 'event', 'provider', 'price', 'plan', 'schedule', 'location', 'instructor', 'alert', 'bonus', 'span', '_default_', '_config_', '_schema_'],
	// member: ['payment', 'profile', 'message', 'track'],
	// attend: ['attend'],
	// local: ['@config@'],
}

/** a list of Fields on which to Filter Documents, when determining Type-2 delta-inserts */
export let FILTER: IObject<string[]> = {
	// [COLLECTION.client]: [FIELD.store, FIELD.key],
	// [COLLECTION.member]: [FIELD.store, FIELD.type, FIELD.uid],
	// [COLLECTION.attend]: [FIELD.store, FIELD.type, FIELD.uid],
}

export let SORTBY: IObject<TString> = {
	// [STORE.provider]: ["sort", FIELD.key],
	// [STORE.plan]: ["sort", FIELD.key],
	// [STORE.schedule]: ["location", FIELD.type, "day", "start", FIELD.key],
	// [STORE.calendar]: [FIELD.key, "start"],
	// [STORE.class]: FIELD.key,
	// [STORE.event]: [FIELD.key, "name"],
	// [STORE.price]: [FIELD.key, FIELD.type],
	// [STORE.location]: ["sort", FIELD.key],
	// [STORE.instructor]: ["sort", FIELD.key],
	// [STORE.bonus]: ["sort", FIELD.key],
	// [STORE.span]: [FIELD.key, "duration"],
	// [STORE.default]: [FIELD.type, FIELD.key],
	// [STORE.schema]: [FIELD.type, FIELD.key],
	// [STORE.profile]: [FIELD.uid, FIELD.type, FIELD.effect],
	// [STORE.payment]: [FIELD.uid, "stamp", FIELD.type],
	// [STORE.attend]: [FIELD.uid, "date", FIELD.type],
}