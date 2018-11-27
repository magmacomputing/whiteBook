import { FIELD } from '@dbase/data/data.define';
import { TString } from '@lib/type.library';

export type TStoreAdmin = '_schema' | '_config_' | '_default_';
export type TStoreClient = 'class' | 'event' | 'price' | 'plan' | 'provider' | 'schedule' | 'calendar' | 'location' | 'instructor';
export type TStoreMember = 'profile' | 'payment' | 'bonus';
export type TStoreAttend = 'attend';
export type TTypeDefault = TStoreClient | 'icon';

export type TMeta = IMeta | IMeta[];

type TSpan = 'full' | 'half';
type TPrice = TSpan | 'topUp';
type TPayment = 'topUp' | 'hold' | 'credit' | 'close';
type TProfile = 'plan' | 'claim' | 'info' | 'pref';
type TSchedule = 'event' | 'class' | 'special';
type TCalendar = 'event' | 'special'
type TClass = 'AeroStep' | 'HiLo' | 'MultiStep' | 'SmartStep' | 'StepBasic' | 'StepDown' | 'StepIn' | 'Zumba' | 'ZumbaStep';
export type TPlan = 'member' | 'casual' | 'gratis' | 'student' | 'core' | 'intro';
export type TProvider = 'identity' | 'oauth' | 'email' | 'play' | 'phone' | 'anonymous';

//	/register
type TRole = 'admin' | 'member' | 'guest';
export interface ICustomClaims {	// a special sub-set of fields from the User Token
	claims: {
		roles?: TRole[];
		plan?: TPlan;												// if set, we know the Member is fully-defined, otherwise check /member/profile/plan
		memberName?: string;
		memberAllow?: string[];
		memberDeny?: string[];
	}
}

// These are the meta- and common-fields for a standard collection document
export interface IMeta {
	[FIELD.id]?: string;									// the _id field on the remote database
	[FIELD.create]?: number;							// the time when originally created
	[FIELD.update]?: number;							// the time when last updated
	[FIELD.effect]?: number;							// the time from which (greater-than-or-equal) this row is effective
	[FIELD.expire]?: number;							// the time before which (less-than) this row is expired, or '0' for un-expired
	[FIELD.hidden]?: boolean;							// valid value, but not to be displayed to the client
	[FIELD.disable]?: boolean;						// valid value, greyed-out to the client
}

/**
 * We have two main types of 'store' documents.  
 * One for 'client', keyed by 'store/type/key',  
 * the other for 'member' & 'attend', keyed by 'store/type/uid'
 */
export type TStoreBase = IClientBase | IMemberBase | IAttendBase;
interface IClientBase extends IMeta {
	[FIELD.store]: TStoreClient | TStoreAdmin;
	[FIELD.type]?: string;
	[FIELD.key]: string | number;
	[FIELD.icon]?: string;									// an optional icon for the UI
}
interface IMemberBase extends IMeta {
	[FIELD.store]: TStoreMember;
	[FIELD.type]?: string;
	[FIELD.uid]: string;
}
interface IAttendBase extends IMeta {
	[FIELD.store]: TStoreAttend;
	[FIELD.type]?: string;
	[FIELD.uid]: string;
}
export interface IStoreMeta extends IMeta {
	[key: string]: any;											// add in index-signature
}
export const isClientStore = (store: TStoreBase): store is IClientBase =>
	(<IClientBase>store)[FIELD.key] !== undefined;

//	/client/_default_
export interface IDefault extends IClientBase {
	[FIELD.store]: '_default_';
	[FIELD.type]: TTypeDefault;
	[FIELD.key]: string;
}
//	/client/_config_
export interface IConfig extends IClientBase {
	[FIELD.store]: '_config_';
	[FIELD.type]: string;
	value: any;
}

//	/client/price
export interface IPrice extends IClientBase {
	[FIELD.store]: 'price';
	[FIELD.type]: TPrice;
	[FIELD.key]: TPlan;
	amount: number;
}

//	/client/plan
export interface IPlan extends IClientBase {
	[FIELD.store]: 'plan';
	[FIELD.key]: string;
	desc: string;
	sort: number;
}
//	/client/class
export interface IClass extends IClientBase {
	[FIELD.store]: 'class';
	[FIELD.type]: TSpan;
	[FIELD.key]: TClass;
	color: string;
	desc?: string;
}

//	/client/event
export interface IEvent extends IClientBase {
	[FIELD.store]: 'event';
	[FIELD.key]: string;
	name: string;
	desc?: string;
	class: TClass | TClass[];
}

//	/client/calendar
export interface ICalendar extends IClientBase {
	[FIELD.store]: 'calendar';
	[FIELD.type]: TCalendar;
	[FIELD.key]: number;
	name: string;
	desc?: string;
	day: number;
	location?: string;
	start: string;
}

//	/client/schedule
export interface ISchedule extends IClientBase {
	[FIELD.store]: 'schedule';
	[FIELD.type]: TSchedule;
	[FIELD.key]: TClass | string;
	day: number;
	location: string;
	start: string;
	price?: number;											// infer the member's price for this class
}

//	/client/location
export interface ILocation extends IClientBase {
	[FIELD.store]: 'location';
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
	[FIELD.store]: 'instructor';
	name: string;
	link?: {
		type: string;
		[property: string]: any;
	}[];
}

//	/client/schedule
export interface IProvider extends IClientBase {
	[FIELD.store]: 'provider';
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

//	/member/profile
export interface IProfile extends IMemberBase {
	[FIELD.store]: 'profile';
	[FIELD.type]: TProfile;
}
export interface IProfilePlan extends IProfile {
	[FIELD.type]: 'plan';
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
export interface IPayment extends IMemberBase {
	[FIELD.store]: 'payment';
	[FIELD.type]: TPayment;
	amount: number;										// how much actually paid (may be different from plan.topUp.amount)
	stamp: number;										// create-date
	bank?: number;										// un-used credit from previous payment
	expiry?: number;									// six-months from _effect
	approve?: {												// acknowledge receipt of payment
		uid: string;
		stamp: number;
		note?: TString;
	},
	note?: TString;
	plan?: string;										// the Plan-type this payment covers
}

//	/member/bonus
export interface IBonus extends IMemberBase {
	[FIELD.store]: 'bonus',
	[FIELD.type]: string;
	stamp: number;
	expiry?: number;
}

// /attend
export interface IAttend extends IAttendBase {
	payment: string;									// the /member/payment _id
	schedule: string;									// the /client/schedule _id
	stamp: number;										// the timestamp of the check-in
	date: number;											// YYYYMMDD of the attend
	amount: number;										// the amount the member was charged
	note: TString;										// any notes recorded
	track?: {													// to use in bonus-checking
		day: number;										// weekDay attended
		week: number;										// yearWeek attended
		month: number;									// yearMonth attended
	}
}