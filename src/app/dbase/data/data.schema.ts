import { firestore, UserInfo } from 'firebase';

import { COLLECTION, STORE, FIELD, CLASS, EVENT, CONNECT, BONUS, REACT, Auth, PLAN, PRICE, PAYMENT, PROFILE, STATUS, SCHEDULE, MESSAGE, SPAN } from '@dbase/data/data.define';
import { TString } from '@library/type.library';

type TStoreConfig = STORE.schema | STORE.config | STORE.default;
type TStoreClient = STORE.class | STORE.event | STORE.price | STORE.plan | STORE.provider | STORE.schedule | STORE.calendar | STORE.location | STORE.instructor | STORE.bonus | STORE.span | STORE.alert | STORE.icon;
type TStoreUser = STORE.profile | STORE.payment | STORE.gift | STORE.message | STORE.migrate | STORE.attend | STORE.register | STORE.status | STORE.import;
type TStoreForum = STORE.comment | STORE.react;

export type FBoolean = boolean | undefined | firestore.FieldValue;
export type FNumber = number | undefined | firestore.FieldValue;
export type FString = TString | undefined | firestore.FieldValue;
export type FType<T> = Exclude<T, firestore.FieldValue>;

// These are the meta- and common-fields for a standard document
export interface IMeta {
	[FIELD.create]?: number;							// the time when originally created
	[FIELD.update]?: number;							// the time when last updated
	[FIELD.access]?: number;							// the time when last accessed
	[FIELD.effect]?: FNumber;							// the time from which (greater-than-or-equal) this row is effective
	[FIELD.expire]?: FNumber;							// the time before which (less-than) this row is expired, or '0' for un-expired
	[FIELD.hidden]?: FBoolean;						// valid value, but not to be displayed to the client
	[FIELD.disable]?: FBoolean;						// valid value, greyed-out to the client

	[FIELD.id]: string;										// the id of the document, generated by FireBase
	[FIELD.store]: STORE;									// each document must declare a 'store' field
	[FIELD.type]?: string | number;				// an optional 'type' code to qualify the 'store'
	[FIELD.note]?: TString;								// an optional 'note' on all documents
}

/**
 * We have two main types of 'store' documents.  
 * a) one for 'client' & 'local' (keyed by 'store/type?/key'),
 * b) the other for 'admin', 'member', 'forum' & 'attend' (keyed by 'store/type?/uid')
 */
export type TStoreBase = IClientBase | IUserBase | IForumBase | IMigrate;
export interface IClientBase extends IMeta {
	[FIELD.store]: TStoreClient | TStoreConfig;
	[FIELD.key]: string | number;
	[FIELD.image]?: string;									// an optional icon for the UI
}
interface IUserBase extends IMeta {				// this is the base for Member-related documents
	[FIELD.store]: TStoreUser;
	[FIELD.uid]: string;
	[FIELD.stamp]: number;
}
export interface IForumBase extends IMeta {
	[FIELD.store]: TStoreForum;
	[FIELD.type]: STORE;										// allow for Forum on any Store type
	[FIELD.uid]: string;										// the Member making the feedback
	[FIELD.key]: string;										// key to the Store the Member is referencing
	[FIELD.stamp]: number;
	track: {																// to use in feedback-analysis
		date: number;													// yearMonthDay
	} & Record<string, string | number>,		// additional info to assist tracking
}

export interface IImport extends IUserBase {
	[FIELD.store]: STORE.import;						// record of Google Sheet on migrate
	[FIELD.uid]: string;
	credit: number;
	email: string;
	picture: string;
	plan: string;
	sheetName: string;
	userName: string;
	providers: TProviderInfo[]
}
export interface IMigrate extends IMeta {	// these allow for reconciliation of migrated event
	[FIELD.store]: STORE.migrate;
	[FIELD.type]: STORE.event | STORE.class;
	[FIELD.uid]: string;
	[FIELD.key]: string;
	[COLLECTION.attend]: {
		[order: string]: CLASS;
	}
}
export interface IStoreMeta extends IMeta, Record<string, any> {}

//	/client/_default_
export interface IDefault extends IClientBase {
	[FIELD.store]: STORE.default;
	[FIELD.type]: TStoreClient;						// Client store to default
	[FIELD.key]: string;
}
//	/client/_config_
export interface IConfig extends IClientBase {
	[FIELD.store]: STORE.config;
	[FIELD.type]: string;
	value: any;
}
//	/client/_schema_
export interface ISchema extends IClientBase {
	[FIELD.store]: STORE.schema;
	[FIELD.type]: COLLECTION;
	[FIELD.key]: STORE;
	[FIELD.sort]?: TString;
	desc: string;
	filter?: TString;
}

//	/client/price
export interface IPrice extends IClientBase {
	[FIELD.store]: STORE.price;
	[FIELD.type]: PRICE;
	[FIELD.key]: PLAN;
	amount: number;
}

//	/client/bonus
export interface IBonus extends IClientBase {
	[FIELD.store]: STORE.bonus;
	[FIELD.key]: Exclude<BONUS, BONUS.gift>;	// all Except 'gift'
	free: number | TString;							// number of free classes available, or string[] of classes available
	level: number;											// number of classes required to attend previously, before this Bonus
	rule: TString;
	desc: TString;
	sort?: number;
	count?: number;
	amount?: number;										// an optional amount to apply
}

//	/client/plan
export interface IPlan extends IClientBase {
	[FIELD.store]: STORE.price;
	[FIELD.key]: PLAN;
	[FIELD.sort]: number;
	[STORE.bonus]?: boolean;						// allowed to apply Bonus
	desc: string;
	rule?: TString;
	expiry?: number;										// number of months a Payment is active (before it is auto-expired)
}

//	/client/class
export interface IClass extends IClientBase {
	[FIELD.store]: STORE.class;
	[FIELD.type]: SPAN;
	[FIELD.key]: CLASS;
	color: string;
	desc?: string;
}

//	/client/event
export interface IEvent extends IClientBase {
	[FIELD.store]: STORE.event;
	[FIELD.key]: string;
	agenda: CLASS[];									// the Classes on offer for this Event
	name: string;
	desc?: string;
}

//	/client/calendar
export interface ICalendar extends IClientBase {
	[FIELD.store]: STORE.calendar;
	[FIELD.type]: EVENT;
	[FIELD.key]: number;
	name: string;
	desc?: string;
	day: number;
	start?: string;
	[STORE.location]?: string;
	[STORE.instructor]?: string;
}

//	/client/schedule
export interface TBonus {							// a sub-type of IBonus
	[FIELD.id]: string;
	[FIELD.type]: BONUS;
	[STORE.gift]?: IGift[];							// the /member/gift updates for this payment
	count: number;											// the number of this Gift
	desc: TString;											// message to Member
	amount?: number;										// an optional amount (if other than $0)
}
export type TForum = {
	[STORE.comment]?: TString;
	[STORE.react]?: REACT;
}
export interface ISchedule extends IClientBase {
	[FIELD.store]: STORE.schedule | STORE.calendar;
	[FIELD.type]: SCHEDULE;
	[FIELD.key]: CLASS;
	day: number;
	location?: string;
	instructor?: string;
	start: string;
	span?: string;
	price?: IPrice;											// the regular price detail for this class
	amount?: number;										// infer the member's price for this class
	bonus?: TBonus;											// the Bonus tracking which can be applied to this Schedule
	elect?: BONUS;											// name the Bonus the Member chooses (override calc)
	count?: number;											// number of Attends
	forum?: TForum;
}

//	/client/location
export interface ILocation extends IClientBase {
	[FIELD.store]: STORE.location;
	[FIELD.key]: string;
	name: string;
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
export interface IInstructor extends IClientBase {
	[FIELD.store]: STORE.instructor;
	name: string;
	link?: {
		[FIELD.type]: string;
		[property: string]: any;
	}[];
}

//	/client/span
export interface ISpan extends IClientBase {
	[FIELD.store]: STORE.span;
	[FIELD.key]: SPAN | CLASS;
	[FIELD.type]: SCHEDULE;
	duration: number;
}

//	/client/alert									// <key> is immaterial
export interface IAlert extends IClientBase {
	[FIELD.store]: STORE.alert;
	[FIELD.type]: STORE.schedule | STORE.event;
	[STORE.location]?: string;
}

//	/client/react									// Member reaction icons
export interface IIcon extends IClientBase {
	[FIELD.store]: STORE.icon;
	[FIELD.type]: STORE.react | STORE.class | STORE.event | STORE.provider | STORE.bonus;
	[FIELD.key]: keyof typeof REACT | CLASS | EVENT | Auth.PROVIDER | BONUS;
	[FIELD.sort]: number;
	image: string;
}

//	/client/schedule
export interface IProvider extends IClientBase {
	[FIELD.store]: STORE.provider;
	[FIELD.type]: Auth.METHOD;
	[FIELD.key]: string;
	sort?: number;									// list-order to display to User
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
export interface IMessage extends IUserBase {
	[FIELD.store]: STORE.message;
	[FIELD.type]: MESSAGE;
}

//	/member/profile
export interface IProfile extends IUserBase {
	[FIELD.store]: STORE.profile;
	[FIELD.type]: PROFILE;
}
export interface IProfilePlan extends IProfile {
	[FIELD.type]: PROFILE.plan;
	[PROFILE.plan]: PLAN;
	bump?: PLAN;												// auto-upgrade Plan on next topUp Payment
}
export interface IProfileClaim extends IProfile {
	[FIELD.type]: PROFILE.claim;
	[PROFILE.claim]: ICustomClaims;
}
export interface IProfileInfo extends IProfile {
	[FIELD.type]: PROFILE.info;
	[PROFILE.info]: IMemberInfo;
}
export interface IProfilePref extends IProfile {
	[FIELD.type]: PROFILE.pref;
	[PROFILE.pref]: TString;
}
export type TProfileInfo = IProfileInfo | IProfileInfo[];

export interface IMemberInfo {				// Conformed Info across Providers
	providerId: string;
	providerUid: string;               	// Provider's UserId
	firstName?: string;
	lastName?: string;
	displayName?: string;               // their Provider displayname
	email?: string;
	gender?: string;
	photoURL?: string;
	birthDay?: number;
}

//	/member/payment
export interface IPayment extends IUserBase {
	[FIELD.store]: STORE.payment;
	[FIELD.type]: PAYMENT;
	link?: {													// used during AttendService to determine Payment hierarchy
		child?: string;									// the child Payment
		parent?: string;								// the parent Payment
		index?: number;									// the Payment position
	}
	amount?: number;									// how much actually paid (may be different from plan.topUp.amount)
	adjust?: number;									// a manual adjustment to a topUp
	bank?: number;										// un-used funds from previous payment
	hold?: number;										// number of days to extend expiry
	expiry?: number;									// usually six-months from _effect
	approve?: {												// acknowledge receipt of payment
		[FIELD.uid]: string;
		[FIELD.stamp]: number;
		[FIELD.note]?: TString;
	},
}

//	/member/gift
export interface IGift extends IUserBase {
	[FIELD.store]: STORE.gift,
	[FIELD.type]?: string;
	limit: number;
	desc?: TString;
	expiry?: number;
	count?: number;										// number of Attends so-far for this Gift
}

// /attend
export interface IAttend extends IUserBase {
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
		day: number;										// weekDay attended (1-7, 1=Mon)
		week: number;										// yearWeek attended
		month: number;									// yearMonth attended
	}
}

//	/forum/comment
export interface IComment extends IForumBase {
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
export interface IReact extends IForumBase {
	[FIELD.store]: STORE.react;
	[STORE.react]: REACT;
}

//	/admin/register
export interface ICustomClaims {		// a special sub-set of fields from the User Token
	alias?: string;
	roles?: Auth.ROLE[];							// TODO: does this need to be Array?
	allow?: string[];
	deny?: string[];
}
export type TUser = UserInfo & {
	customClaims?: ICustomClaims;
	providerData?: (UserInfo | null)[];
}
type TProviderInfo = {
	id: string;
	provider: Auth.PROVIDER;
	firstName: string;
	lastName: string;
	userName: string;
	email: string;
	photoURL?: string;
	gender?: 'male' | 'female';
	isAdmin?: true;
	birthDay?: number;
}
export interface IRegister extends IUserBase {
	[FIELD.store]: STORE.register;
	user: TUser;
}

export interface ISummary {
	bank: number;													// rollover from previous Payment
	paid: number;													// topUp amount for active Payment
	adjust: number;												// debit amount for active Payment
	spend: number;												// sum of Attends' amount
	funds: number;												// active Payment credit:	bank + paid + adjust - spend

	credit: number;												// whole Account credit:	bank + paid + adjust - spend + pend
	pend: number;													// sum of not-yet-Active Payments
}

//	/member/status
export interface IStatus extends IUserBase {
	[FIELD.store]: STORE.status;
	[FIELD.type]: STATUS;
}
export interface IStatusAccount extends IStatus {
	[FIELD.type]: STATUS.account;
	summary: ISummary;
}
export interface IStatusConnect extends IStatus {
	[FIELD.type]: STATUS.connect;
	state: CONNECT;
	device?: string | null;
}