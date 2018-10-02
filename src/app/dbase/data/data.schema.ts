import { FIELD } from '@dbase/data/data.define';

export type TStoreAdmin = '_schema' | '_config_' | '_default_';
export type TStoreClient = 'class' | 'event' | 'price' | 'plan' | 'provider' | 'schedule' | 'calendar' | 'location' | 'instructor';
export type TStoreMember = 'profile' | 'account' | 'bonus';
export type TStoreAttend = string;			// Attend docs will have a <store> that links to an Account _id
export type TStore = TStoreClient | TStoreMember;

export type TStoreBase = IStoreBase | IStoreBase[];

type TSpan = 'full' | 'half';
type TPrice = TSpan | 'topUp' | 'hold';
type TProfile = 'plan' | 'claim' | 'info';
type TSchedule = 'event' | 'class' | 'special';
type TClass = 'AeroStep' | 'HiLo' | 'MultiStep' | 'SmartStep' | 'StepBasic' | 'StepDown' | 'StepIn' | 'Zumba' | 'ZumbaStep';
export type TPlan = 'member' | 'casual' | 'gratis' | 'student' | 'core' | 'intro';
export type TProvider = 'social' | 'oauth' | 'email' | 'play' | 'phone' | 'anonymous';

//	/register
type TRole = 'admin' | 'member' | 'guest';
export interface ICustomClaims {	// a special sub-set of fields from the User Token
	claims: {
		roles?: TRole[];
		memberName?: string;
		memberAllow?: string[];
		memberDeny?: string[];
	}
}

// These are the meta-fields for a standard <store> record
export interface IMeta {
	[FIELD.id]?: string;									// the _id field on the remote database
	[FIELD.create]?: number;							// the time when originally created
	[FIELD.update]?: number;							// the time when last updated
	[FIELD.effect]?: number;							// the time from which (greater-than-or-equal) this row is effective
	[FIELD.expire]?: number;							// the time before which (less-than) this row is expired, or '0' for un-expired
	[FIELD.hidden]?: boolean;							// valid value, but not to be displayed to the client
	[FIELD.disable]?: boolean;						// valid value, greyed-out to the client
}

// to use when building a new Store Document for insert
export interface IStoreBase extends IMeta {
	[FIELD.store]: TStore | TStoreAdmin | TStoreAttend,
	[FIELD.type]?: string,
	[FIELD.key]?: string,
}

export interface IStoreMeta extends IStoreBase {
	[FIELD.id]: string;										// override the 'optional' _id on IMeta
	[FIELD.key]: string;									// override the 'optional' key on IStoreBase
	[key: string]: any;										// additional fields specific to a <store>
}

//	/client/_default_
export interface IDefault extends IStoreBase {
	[FIELD.store]: '_default_';
	[FIELD.type]: TStoreClient;
	[FIELD.key]: string;
}
export interface IDefaultPrice extends IDefault {
	[FIELD.type]: 'price';
}
export interface IDefaultPlan extends IDefault {
	[FIELD.type]: 'plan';
}

//	/client/price
export interface IPrice extends IStoreBase {
	[FIELD.store]: 'price';
	[FIELD.type]: TPrice;
	[FIELD.key]: TPlan;
	amount: number;
}

//	/client/plan
export interface IPlan extends IStoreBase {
	[FIELD.store]: 'plan';
	[FIELD.key]: string;
	desc: string;
	sort: number;
}
//	/client/class
export interface IClass extends IStoreBase {
	[FIELD.store]: 'class';
	[FIELD.type]: TSpan;
	[FIELD.key]: TClass;
	color: string;
	desc?: string;
}

//	/client/event
export interface IEvent extends IStoreBase {
	[FIELD.store]: 'event';
	[FIELD.key]: string;
	name: string;
	desc: string;
	class: TClass | TClass[];
}

//	/client/schedule
export interface ISchedule extends IStoreBase {
	[FIELD.store]: 'schedule';
	[FIELD.type]: TSchedule;
	[FIELD.key]: TClass | string;
	day: number;
	location: string;
	start: string;
}

export interface ILocation extends IStoreBase {
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

export interface IInstructor extends IStoreBase {
	[FIELD.store]: 'instructor';
	name: string;
	link?: {
		type: string;
		[property: string]: any;
	}[];
}

//	/client/schedule
export interface IProvider extends IStoreBase {
	[FIELD.store]: 'provider';
	[FIELD.type]: TProvider;
	[FIELD.key]: string;
	sort: number;								// list-order to display to User
	prefix?: string;
	scope?: string | string[];					// if array, joinScope determines how to encode as a string
	joinScope?: string;							// what character separates the scope parameters, default ','
	params?: object;							// custom parameters

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
export interface IProfile extends IStoreBase {
	[FIELD.store]: 'profile';
	[FIELD.type]: TProfile;
	// [FIELD.key]?: string;													// UserID
}
export interface IProfilePlan extends IProfile {
	[FIELD.type]: 'plan';
	plan: TPlan;
}
export interface IProfileClaim extends IProfile {
	[FIELD.type]: 'claim';
	claim: ICustomClaims;
}
export interface IProfileInfo extends IProfile {
	[FIELD.type]: 'info';
	isNewUser: boolean;
	providerId: string;
	username?: string | null;
	profile: any;
}

//	/member/account
export interface IAccount extends IStoreBase {
	[FIELD.store]: 'account';
	[FIELD.type]: TPrice;
	amount: number;
	stamp: number;
	active: boolean;
	bank?: number;
	expiry?: number;
	approve?: {
		key: string;
		stamp: number;
	}
}

//	/member/bonus
export interface IBonus extends IStoreBase {
	[FIELD.store]: 'bonus',
	[FIELD.type]: string;
	stamp: number;
	expiry?: number;
}

// /attend
export interface IAttend extends IMeta {
	[FIELD.store]: string;
	[FIELD.type]: TClass;
	stamp: number;
	cost: number;
	track?: {
		day: number;
		week: number;
		month: number;
	}
}