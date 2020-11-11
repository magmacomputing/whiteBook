import type { auth, COLLECTION, STORE, FIELD, CLASS, EVENT, CONNECT, BONUS, REACT, PLAN, PRICE, PAYMENT, PROFILE, STATUS, SCHEDULE, MESSAGE, SPAN, COLOR, TRACK } from '@dbase/data.define';
import type { TString } from '@library/type.library';
import type { Instant } from '@library/instant.library';

type TStoreAdmin = STORE.register | STORE.sheet;
type TStoreConfig = STORE.schema | STORE.config | STORE.default;
type TStoreClient = STORE.class | STORE.event | STORE.price | STORE.plan | STORE.provider | STORE.schedule | STORE.calendar | STORE.location | STORE.instructor | STORE.bonus | STORE.span | STORE.alert | STORE.icon;
type TStoreMember = STORE.profile | STORE.payment | STORE.gift | STORE.message | STORE.attend | STORE.status | STORE.migrate | STORE.log;
type TStoreForum = STORE.react | STORE.comment;

// These are the meta- and common-fields for a standard document
interface BaseDocument {
	[FIELD.create]?: number;								// the time when originally created
	[FIELD.update]?: number;								// the time when last updated
	[FIELD.access]?: number;								// the time when last accessed
	[FIELD.effect]?: number;								// the time from which (greater-than-or-equal) this row is effective
	[FIELD.expire]?: number;								// the time before which (less-than) this row is expired, or '0' for un-expired

	[FIELD.id]: string;										// the id of the document, generated by FireBase
	[FIELD.store]: STORE;										// each document must declare a 'store' field
	[FIELD.type]?: string | number;					// an optional 'type' code to qualify the 'key'
}

export interface FireDocument extends BaseDocument {
	[key: string]: any;											// allow 'any' additional fields
}

/**
 * We have two main types of 'store' documents.  
 * a) one for 'client' & 'local' (keyed by 'store/type?/key'),
 * b) the other for 'admin', 'member' & 'attend' (keyed by 'store/type?/uid')
 * 
 * Plus a small set of miscellaneous collections;
 * a) forum (keyed by 'store/type/uid/key')
 * b) zoom (keyed by 'store/type')
 */
interface KeyFields extends BaseDocument {
	[FIELD.key]: string;										// primary identifier
}
interface UserFields extends BaseDocument {
	[FIELD.uid]: string;										// all user-documents require a 'uid' field
	[FIELD.stamp]: number;
}

interface AdminCollection extends KeyFields, Omit<UserFields, FIELD.stamp> {
	[FIELD.hidden]?: boolean;								// valid value, but not to be displayed to the client
	[FIELD.store]: TStoreAdmin;
}
interface ClientCollection extends KeyFields {
	[FIELD.hidden]?: boolean;								// valid value, but not to be displayed to the client
	[FIELD.disable]?: boolean;							// valid value, greyed-out to the client
	[FIELD.store]: TStoreClient | TStoreConfig;
	[FIELD.note]?: TString;									// an optional 'note' on all documents
	[FIELD.image]?: string;									// an optional icon for the UI
}
interface MemberCollection extends UserFields {			// this is the base for Member-related documents
	[FIELD.store]: TStoreMember;
	[FIELD.type]: PROFILE | PAYMENT | STATUS | TRACK | MESSAGE | STORE.event | STORE.class;
}
interface ForumCollection extends KeyFields, UserFields {
	[FIELD.store]: TStoreForum;
	[FIELD.type]: STORE;										// allow for Forum on any Store type
	track: {																// to use in feedback-analysis
		date: number;													// yearMonthDay
		[index: string]: string | number;			// additional into to assist tracking
	}
}

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

//	/client/_default_
export interface Default extends ClientCollection {
	[FIELD.store]: STORE.default;
	[FIELD.type]: TStoreClient;							// Client store to be defaulted
}
//	/client/_config_
export interface Config extends ClientCollection {
	[FIELD.store]: STORE.config;
	[FIELD.type]: string;
	value: any;
}
//	/client/_schema_
export interface Schema extends ClientCollection {
	[FIELD.store]: STORE.schema;
	[FIELD.type]: COLLECTION;
	[FIELD.key]: STORE;
	[FIELD.sort]?: TString;
	rules: { read: 'isAdmin' | 'isMine' | 'isAuth' | boolean }
	filter?: TString;
}

//	/client/price
export interface Price extends ClientCollection {
	[FIELD.store]: STORE.price;
	[FIELD.type]: PRICE;
	[FIELD.key]: PLAN;
	amount: number;
}

//	/client/bonus
export interface Bonus extends ClientCollection {
	[FIELD.store]: STORE.bonus;
	[FIELD.key]: BONUS;
	[FIELD.sort]: number;								// sequence of processing
	free: number | TString;							// number of free classes available, or string[] of classes available
	level: number;											// number of classes required to attend previously, before this Bonus
	rule: TString;
	count?: number;											// how many times claimed
	amount?: number;										// an optional amount to apply
}

//	/client/plan
export interface Plan extends Omit<ClientCollection, FIELD.type> {
	[FIELD.store]: STORE.price;
	[FIELD.key]: PLAN;
	[FIELD.sort]: number;
	[STORE.bonus]?: boolean;						// allowed to apply Bonus
	rule?: TString;
	expiry?: number;										// number of months a Payment is active (before it is auto-expired)
}

//	/client/class
export interface Class extends ClientCollection {
	[FIELD.store]: STORE.class;
	[FIELD.type]: SPAN;
	[FIELD.key]: CLASS;
	color: COLOR;
}

//	/client/event
export interface Event extends ClientCollection {
	[FIELD.store]: STORE.event;
	[FIELD.name]: string;
	agenda: CLASS[];									// the Classes on offer for this Event
}

//	/client/calendar
export interface Calendar extends ClientCollection {
	[FIELD.store]: STORE.calendar;
	[FIELD.type]: EVENT;
	[FIELD.name]: string;
	day: Instant.WEEKDAY;
	start?: string;
	[STORE.location]?: string;
	[STORE.instructor]?: string;
}

//	/client/schedule
export interface TBonus {							// a sub-type of IBonus
	[FIELD.id]: string;
	[FIELD.type]: BONUS;
	[STORE.gift]?: Gift[];							// the /member/gift updates for this payment
	count: number;											// the number of this Gift
	note?: TString;											// message to Member
	amount?: number;										// an optional amount (if other than $0)
}
export type TForum = {
	[STORE.comment]?: TString;
	[STORE.react]?: REACT;
}
export interface Schedule extends ClientCollection {
	[FIELD.store]: STORE.schedule | STORE.calendar;
	[FIELD.type]: SCHEDULE;
	[FIELD.key]: CLASS;
	day: Instant.WEEKDAY;
	location?: string;
	instructor?: string;
	start: string;
	span?: string;
	price?: Price;											// the regular price detail for this class
	amount?: number;										// infer the member's price for this class
	bonus?: TBonus;											// the Bonus tracking which can be applied to this Schedule
	elect?: BONUS;											// names the Bonus the Member chooses (override calc)
	count?: number;											// number of Attends
	forum?: TForum;											// Member comment to use on their Attend of this Schedule
}

//	/client/location
export interface Location extends ClientCollection {
	[FIELD.store]: STORE.location;
	[FIELD.name]: string;
	address?: {
		line1: string;
		line2?: string;
		line3?: string;
		suburb?: string;
		state?: string;
		postcode?: number;
	},
	contact?: Record<string, any>,
	map?: {
		geo?: {
			latitude: number;
			longitude: number;
		},
		link?: string;
	}
}

//	/client/instructor
export interface Instructor extends ClientCollection {
	[FIELD.store]: STORE.instructor;
	[FIELD.name]: string;
	link?: {
		[FIELD.type]: string;
		[property: string]: any;
	}[];
}

//	/client/span
export interface Span extends ClientCollection {
	[FIELD.store]: STORE.span;
	[FIELD.key]: SPAN | CLASS;
	[FIELD.type]: SCHEDULE;
	duration: number;
}

//	/client/alert									// <key> is immaterial
export interface Alert extends ClientCollection {
	[FIELD.store]: STORE.alert;
	[FIELD.type]: STORE.schedule | STORE.event;
	[STORE.location]?: string;
}

//	/client/react									// Member reaction icons
export interface Icon extends ClientCollection {
	[FIELD.store]: STORE.icon;
	[FIELD.type]: STORE.react | STORE.class | STORE.event | STORE.provider | STORE.bonus;
	[FIELD.key]: keyof typeof REACT | CLASS | EVENT | auth.PROVIDER | BONUS;
	[FIELD.sort]: number;
	image: string;
}

//	/client/schedule
export interface Provider extends ClientCollection {
	[FIELD.store]: STORE.provider;
	[FIELD.type]: auth.METHOD;
	[FIELD.sort]?: number;					// list-order to display to User
	prefix?: string;
	scope?: TString;								// if array, joinScope determines how to encode as a string
	custom?: TString;								// custom OAuth parameters
	joinScope?: string;							// what character separates the scope parameters, default ','
	params?: object;								// custom parameters

	oauth?: {
		profile: {
			providerId: string;
			displayName: string;
			photoURL: string;
			email: string;
			phoneNumber?: string;
		}
		url: {
			auth: string;
			token: string;
			profile: string;
		};
		uri: {
			redirect_uri: string;
			request_url: string;
		},
		client: {
			id: string;
			secret: string;
		};
		token: {
			access: string;
			refresh: string;
		};
		code: {
			grant: string;
			response: string;
		};
	}
}

//	/member/message
export interface Message extends MemberCollection {
	[FIELD.store]: STORE.message;
	[FIELD.type]: MESSAGE;
	[FIELD.note]: TString;
}

//	/member/profile
export interface Profile extends MemberCollection {
	[FIELD.store]: STORE.profile;
	[FIELD.type]: PROFILE;
}
export interface ProfilePlan extends Profile {
	[FIELD.type]: PROFILE.plan;
	[PROFILE.plan]: PLAN;
	bump?: PLAN;												// auto-upgrade Plan on next topUp Payment
}
export interface ProfileClaim extends Profile {
	[FIELD.type]: PROFILE.claim;
	[PROFILE.claim]: CustomClaims;
}
export interface ProfileInfo extends Profile {
	[FIELD.type]: PROFILE.info;
	[PROFILE.info]: {										// Conformed Info across Providers
		providerId: string;
		providerUid: string;              // Provider's UserId
		firstName?: string;
		lastName?: string;
		displayName?: string;             // their Provider displayname
		email?: string;
		gender?: string;
		photoURL?: string;
		birthDate?: number;
	};
}
export interface ProfilePref extends Profile {
	[FIELD.type]: PROFILE.pref;
	[PROFILE.pref]: TString;
}
export interface ProfileToken extends Profile {
	[FIELD.type]: PROFILE.token;
	messaging: {
		token: string;
		valid: boolean;
		error?: { code: string; message: string; };
	}[]
}

//	/member/payment
export interface Payment extends MemberCollection {
	[FIELD.store]: STORE.payment;
	[FIELD.type]: PAYMENT;
	amount?: number;									// how much actually paid (may be different from plan.topUp.amount)
	adjust?: number;									// a manual adjustment to a topUp
	bank?: number;										// un-used funds from previous payment
	hold?: number;										// number of days to extend expiry
	expiry?: number;									// usually six-months from _effect
	approve?: {												// acknowledge receipt of payment
		[FIELD.uid]: string;
		[FIELD.stamp]: number;
		[FIELD.note]?: TString;
	};
	chain?: {													// used during AttendService to determine Payment hierarchy
		child?: string;									// the child Payment
		parent?: string;								// the parent Payment
		index?: number;									// the Payment position
	};
}

//	/member/gift
export interface Gift extends Omit<MemberCollection, FIELD.type> {
	[FIELD.store]: STORE.gift,
	limit: number;										// number of free Attends for this Gift
	expiry?: number;									// optional use-by date for Gift
	count?: number;										// number of Attends so-far for this Gift
	note?: TString;
}

// /attend
export interface Attend extends MemberCollection {
	[FIELD.store]: STORE.attend;
	payment: {
		[FIELD.id]: string;							// the /member/payment _id
		amount: number;									// the amount the member was charged
	},
	timetable: {
		[FIELD.id]: string;							// the /client/schedule or /client/event _id
		[FIELD.store]: STORE.schedule | STORE.calendar;
		[FIELD.type]: SCHEDULE;
		[FIELD.key]: CLASS;
	}
	bonus?: {
		[FIELD.id]: string;
		[FIELD.type]: BONUS;
		count?: number;									// the count of this Bonus
	},
	track: {													// to use in bonus-checking, attend-analysis, etc.
		date: number;										// yearMonthDay attended
		day: Instant.WEEKDAY;						// weekDay attended (1-7, 1=Mon)
		week: number;										// yearWeek attended
		month: number;									// yearMonth attended
	},
	[FIELD.note]?: TString;
}

//	/forum/comment
export interface Comment extends ForumCollection {
	[FIELD.store]: STORE.comment;
	[STORE.comment]: TString;
	response?: {
		[FIELD.uid]: string;
		[FIELD.stamp]: number;
		[STORE.comment]: TString;
		seen?: boolean;
	}[];
}

//	/forum/react
export interface React extends ForumCollection {
	[FIELD.store]: STORE.react;
	[STORE.react]: REACT;
}

//	/admin/register
export interface CustomClaims {					// a special sub-set of fields from the User Token
	alias?: string;
	roles?: auth.ROLE[];									// TODO: does this need to be Array?
	allow?: string[];
	deny?: string[];
}

export interface Register extends AdminCollection {
	[FIELD.store]: STORE.register;
	user: firebase.default.UserInfo & {
		customClaims?: CustomClaims;
		providerData?: (firebase.default.UserInfo | null)[];
	};
}

//	/member/status
export interface Status extends MemberCollection {
	[FIELD.store]: STORE.status;
	[FIELD.type]: STATUS;
}
export interface Account extends Status {
	[FIELD.type]: STATUS.account;
	summary: {
		bank: number;												// rollover from previous Payment
		paid: number;												// topUp amount for active Payment
		adjust: number;											// debit amount for active Payment
		spend: number;											// sum of Attends' amount
		funds: number;											// active Payment credit:	bank + paid + adjust - spend

		credit: number;											// whole Account credit:	bank + paid + adjust - spend + pend
		pend: number;												// sum of not-yet-Active Payments
	};
}
export interface Connect extends Status {
	[FIELD.type]: STATUS.connect;
	state: CONNECT;
	device?: string | null;
}


export interface Track extends MemberCollection {
	[FIELD.store]: STORE.log;
	[FIELD.type]: TRACK;
	msg: string;
	level: number;
	data?: {
		msg: string;
		data?: any[];
	};
	event?: object;
	memberId?: string;
	[FIELD.date]: {												// useful for indexing
		year: number;
		month: number;
		day: number;
	}
}

export interface Sheet extends AdminCollection {
	[FIELD.store]: STORE.sheet;						// record of Google Sheet on migrated member
	credit: number;
	email: string;
	picture: string;
	plan: string;
	sheetName: string;
	userName: string;
	providers: {
		id: string;
		provider: auth.PROVIDER;
		firstName: string;
		lastName: string;
		userName: string;
		email: string;
		photoURL?: string;
		gender?: 'male' | 'female';
		isAdmin?: true;
		birthDate?: number;
	}[];
}
export interface Migrate extends MemberCollection, KeyFields {	// these allow for reconciliation of migrated event
	[FIELD.store]: STORE.migrate;
	[FIELD.type]: STORE.event | STORE.class;
	[COLLECTION.attend]: {
		[order: string]: CLASS;
	}
}
