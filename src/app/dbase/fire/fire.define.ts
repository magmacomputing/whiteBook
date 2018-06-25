import { IObject } from "@lib/object.library";

//	/client											// public data
//		/class										// describe classes
//		/schedule									// weekly class-times
//		/plan											// payment plans
//		/event										// special-event classes (which overrides schedule)
//		/provider									// authentication parameters
//		/client										// IndexedDB sync data
//		/_schema_									// layout of IDB ObjectStores
//		/_config_									// localhost configuration

//	/register/{uid}							// authenticated users
//			/user										// copy of User Account
//			/claims									// added to authentication-token

//	/member/{uid}								// non-variant (birthDay, gender, etc.) member properties
//			/data/account						// payment tracking
//			/data/history						// archive (?)
//			/data/attend						// bridging collection of {uid} and {class}
//			/data/profile						// dynamic member properties

//	/log/{yyyymm}/{dd}/{pushId}	// rolling log of messages / events

export const COLLECTION = {			// collection starts with upper-case, document with lower-case
	Log: '/log',
	Register: '/register',
	Member: '/member',
	Attend: '/attend',
	Client: '/client',
}

export const DOCUMENT = {
	data: `${COLLECTION.Member}/data`,
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

/** These stores will have an '_expire' field enforced by the db.setDoc method */
export const EXPIRES = ['public', 'register', 'member'];
/** These stores will have a 'uid' field enforced by the db.setDoc method */
export const UIDS = ['attend', 'account', 'profile'];

/** a list of Fields on which to Filter Documents, when determining Type-2 delta-inserts */
export const FILTER: IObject<string[]> = {
	[COLLECTION.Client]: [FIELD.store],
	[COLLECTION.Member]: [FIELD.store, FIELD.type, FIELD.uid],
	[COLLECTION.Attend]: [FIELD.store, FIELD.type, FIELD.uid],
}