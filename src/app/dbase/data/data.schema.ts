import { UserInfo, firestore } from 'firebase/app';

import { FIELD, STORE } from '@dbase/data/data.define';
import { ISummary } from '@dbase/state/state.define';
import { TString } from '@lib/type.library';
import { getSlice } from '@dbase/state/state.library';

type TStoreConfig = STORE.schema | STORE.config | STORE.default;
type TStoreClient = STORE.class | STORE.event | STORE.price | STORE.plan | STORE.provider | STORE.schedule | STORE.calendar | STORE.location | STORE.instructor | STORE.bonus | STORE.span | STORE.alert;
type TStoreUser = STORE.profile | STORE.payment | STORE.account | STORE.gift | STORE.message | STORE.migrate | STORE.attend | STORE.register;
type TTypeDefault = TStoreClient | 'icon';

type TSpan = 'full' | 'half';
type TPrice = TSpan | 'topUp' | 'hold' | 'expiry';
type TPayment = 'topUp' | 'hold' | 'credit' | 'debit';
type TProfile = 'plan' | 'claim' | 'info' | 'pref';
type TSchedule = 'event' | 'class' | 'special';
type TCalendar = 'event' | 'special'
export type TClass = 'AeroStep' | 'HiLo' | 'MultiStep' | 'SingleStep' | 'SmartStep' | 'StepBasic' | 'StepDown' | 'StepIn' | 'Zumba' | 'ZumbaStep';
export type TPlan = 'member' | 'casual' | 'gratis' | 'student' | 'core' | 'intro';
export type TProvider = 'identity' | 'oauth' | 'oidc' | 'email' | 'play' | 'phone' | 'anonymous';

export type FBoolean = boolean | undefined | firebase.firestore.FieldValue;
export type FNumber = number | undefined | firebase.firestore.FieldValue;
export type FString = TString | undefined | firebase.firestore.FieldValue;
export type FType<T> = Exclude<T, firestore.FieldValue>;
// These are the meta- and common-fields for a standard collection document
export interface IMeta {
	[FIELD.id]: string;										// the id field on the remote database, generated by FireBase
	[FIELD.create]?: number;							// the time when originally created
	[FIELD.update]?: number;							// the time when last updated
	[FIELD.access]?: number;							// the time when last accessed
	[FIELD.effect]?: FNumber;							// the time from which (greater-than-or-equal) this row is effective
	[FIELD.expire]?: FNumber;							// the time before which (less-than) this row is expired, or '0' for un-expired
	[FIELD.hidden]?: FBoolean;						// valid value, but not to be displayed to the client
	[FIELD.disable]?: FBoolean;						// valid value, greyed-out to the client

	[FIELD.store]: STORE;									// every document must declare the 'store' field
	[FIELD.type]?: string | number;				// an optional 'type' code to qualify the 'store'
	[FIELD.note]?: FString;								// an optional 'note' on all documents
}

/**
 * We have two main types of 'store' documents.  
 * One for 'client' & 'local', keyed by 'store/type?/key',  
 * the other for 'admin', 'member' & 'attend', keyed by 'store/type?/uid'
 */
export type TStoreBase = IClientBase | IUserBase | IMigrateBase;
interface IClientBase extends IMeta {
	[FIELD.store]: TStoreClient | TStoreConfig;
	[FIELD.key]: string | number;
	[FIELD.icon]?: string;									// an optional icon for the UI
}
interface IUserBase extends IMeta {
	[FIELD.store]: TStoreUser;
	[FIELD.uid]: string;
}
export interface IMigrateBase extends IMeta {
	[FIELD.store]: STORE.migrate;
	[FIELD.type]: STORE.event | STORE.class;
	[FIELD.uid]: string;
	[FIELD.key]: string;
	attend: {
		[order: string]: string;
	}
}
export interface IStoreMeta extends IMeta {
	store: STORE;
	[key: string]: any;											// add in index-signature
}
export type TStoreMeta = IStoreMeta | IStoreMeta[];
// client documents have a '<key>' field, user documents have a '<uid>' field
export const isClientDocument = (document: TStoreBase): document is IClientBase =>
	getSlice(document[FIELD.store]) === 'client' || getSlice(document[FIELD.store]) === 'local';

//	/client/_default_
export interface IDefault extends IClientBase {
	[FIELD.store]: STORE.default;
	[FIELD.type]: TTypeDefault;
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
	[FIELD.type]: string;
	[FIELD.key]: string;
	desc: string;
	filter?: TString;
	sort?: TString;
}

//	/client/price
export interface IPrice extends IClientBase {
	[FIELD.store]: STORE.price;
	[FIELD.type]: TPrice;
	[FIELD.key]: TPlan;
	amount: number;
}

//	/client/bonus
export interface IBonus extends IClientBase {
	[FIELD.store]: STORE.bonus;
	[FIELD.key]: 'week' | 'month' | 'sunday' | 'sun3';
	free: number | TString;							// number of free classes available, or string[] of classes available
	level: number;											// number of classes required to attend previously, before this Bonus
	rule: TString;
	desc?: TString;
	sort?: number;
}

//	/client/plan
export interface IPlan extends IClientBase {
	[FIELD.store]: STORE.price;
	[FIELD.key]: string;
	bonus?: boolean;										// allowed to apply Bonus
	desc: string;
	sort: number;
	rule?: TString;
	expiry?: number;										// number of months a Payment is active (before it is auto-expired)
}
//	/client/class
export interface IClass extends IClientBase {
	[FIELD.store]: STORE.class;
	[FIELD.type]: TSpan;
	[FIELD.key]: TClass;
	color: string;
	desc?: string;
}

//	/client/event
export interface IEvent extends IClientBase {
	[FIELD.store]: STORE.event;
	[FIELD.key]: string;
	name: string;
	desc?: string;
	classes: TClass[];
}

//	/client/calendar
export interface ICalendar extends IClientBase {
	[FIELD.store]: STORE.calendar;
	[FIELD.type]: TCalendar;
	[FIELD.key]: number;
	name: string;
	desc?: string;
	day: number;
	location?: string;
	instructor?: string;
	start?: string;
}

//	/client/schedule
export interface ISchedule extends IClientBase {
	[FIELD.store]: STORE.schedule;
	[FIELD.type]: TSchedule;
	[FIELD.key]: TClass | string;
	day: number;
	location?: string;
	instructor?: string;
	start: string;
	span?: string;
	price?: number;											// infer the member's price for this class
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
	contact?: {
		[key: string]: any;
	},
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
		type: string;
		[property: string]: any;
	}[];
}

//	/client/span
export interface ISpan extends IClientBase {
	[FIELD.store]: STORE.span;
	[FIELD.key]: TSpan;
	duration: number;
}

//	/client/alert									// <key> is immaterial
export interface IAlert extends IClientBase {
	[FIELD.store]: STORE.alert;
	[FIELD.type]: 'schedule'
	[FIELD.note]: TString;
	location?: string;
}

//	/client/schedule
export interface IProvider extends IClientBase {
	[FIELD.store]: STORE.provider;
	[FIELD.type]: TProvider;
	[FIELD.key]: string;
	sort: number;										// list-order to display to User
	prefix?: string;
	scope?: TString;								// if array, joinScope determines how to encode as a string
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
	[FIELD.type]: 'diary' | 'alert';
	[FIELD.note]: TString;
}

//	/member/profile
export interface IProfile extends IUserBase {
	[FIELD.store]: STORE.profile;
	[FIELD.type]: TProfile;
}
export interface IProfilePlan extends IProfile {
	[FIELD.type]: STORE.plan;
	plan: TPlan;
}
export interface IProfileClaim extends IProfile {
	[FIELD.type]: 'claim';
	claim: ICustomClaims;
}
export interface IProfileInfo extends IProfile, IMemberInfo {
	[FIELD.type]: 'info';
}
export interface IProfilePref extends IProfile {
	[FIELD.type]: 'pref';
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
	[FIELD.type]: TPayment;
	[FIELD.stamp]: number;						// create-date
	amount: number;										// how much actually paid (may be different from plan.topUp.amount)
	adjust?: number;									// a manual adjustment to a topUp
	bank?: number;										// un-used funds from previous payment
	hold?: number;										// number of days to extend expiry
	expiry?: number;									// six-months from _effect
	approve?: {												// acknowledge receipt of payment
		[FIELD.uid]: string;
		[FIELD.stamp]: number;
		[FIELD.note]?: TString;
	},
}

//	/member/gift
export interface IGift extends IUserBase {
	[FIELD.store]: STORE.gift,
	// [FIELD.type]: string;
	[FIELD.stamp]: number;
	count: number;
	desc?: TString;
	expiry?: number;
}

// /attend
export interface TBonus {
	[FIELD.id]?: string;
	[FIELD.type]?: string;
	gift?: IGift;											// the /member/gift _id for this payment
	scheme?: IBonus;									// the /client/bonus _id for this payment
}
interface TTrack {
	day: number;											// weekDay attended
	date: number;											// yearMonthDay attended
	week: number;											// yearWeek attended
	month: number;										// yearMonth attended
}
export interface IAttend extends IUserBase {
	[FIELD.store]: STORE.attend;
	[FIELD.stamp]: number;						// the timestamp of the check-in
	payment: {
		[FIELD.id]: string;							// the /member/payment _id
		amount: number;									// the amount the member was charged
	},
	timetable: {
		[FIELD.id]: string;							// the /client/schedule or /client/event _id
		[FIELD.store]: string;					// 'schedule' or 'calendar'
		[FIELD.type]: TSchedule;
		[FIELD.key]: TClass;
	}
	bonus?: TBonus;										// override standard price
	track: TTrack;										// to use in bonus-checking, attend-analysis, etc.
}

//	/admin/register
type TRole = 'admin' | 'member' | 'guest';
export interface ICustomClaims {				// a special sub-set of fields from the User Token
	roles?: TRole[];
	plan?: TPlan;													// if set, we know the Member is fully-defined, otherwise check /member/profile/plan
	memberName?: string;
	memberAllow?: string[];
	memberDeny?: string[];
}
export type TUser = UserInfo & {
	customClaims?: ICustomClaims;
}
export interface IRegister extends IUserBase {
	[FIELD.store]: STORE.register;
	user: TUser;
	migrate?: {
		credit: number;
		email: string;
		picture: string;
		plan: string;
		sheetName: string;
		uid: string;
		userName: string;
		providers: {
			id: string;
			provider: 'fb' | 'g+' | 'gh' | 'tw' | 'li';
			firstName: string;
			lastName: string;
			userName: string;
			email: string;
			gender?: 'male' | 'female';
			isAdmin?: boolean;
		}[]
	};
}

//	/member/account
export interface IAccount extends IUserBase {
	[FIELD.store]: STORE.account;
	[FIELD.type]: 'summary';
	stamp: number;																	// date last updated
	summary: ISummary;
}