import { ICustomClaims } from '@dbase/auth/auth.interface';
import { FIELD } from '@dbase/data/data.define';

export type TStore = 'class' | 'event' | 'price' | 'plan' | 'provider' | 'schedule' | 'profile' | 'attend' | 'location' | 'instructor'
type TFeeDefault = 'topUp' | 'hold';
export type TPlan = 'member' | 'casual' | 'gratis' | 'student' | 'core' | 'intro';
type TClass = 'full' | 'half' | 'event';
type TPrice = 'full' | 'half' | 'topUp' | 'hold';
type TProfile = 'plan' | 'claims';
type TSchedule = 'event' | 'class' | 'special'
type TProvider = 'social' | 'oauth' | 'email' | 'play' | 'phone' | 'anonymous';

// These are the meta-fields for a standard record
export interface IMeta {
	[FIELD.id]?: string;									// the _id field on the remote database
	[FIELD.effect]?: number;							// the time from which (greater-than-or-equal) this row is effective
	[FIELD.expire]?: number;							// the time before which (less-than) this row is expired, or '0' for un-expired
	[FIELD.modify]?: number;							// the time when last updated locally
	[FIELD.hidden]?: boolean;							// valid value, but not to be displayed to the client
	[FIELD.disable]?: boolean;						// valid value, greyed-out to the client
};

export interface IStoreMeta extends IMeta {
	[FIELD.id]: string;										// override the 'optional' on IMeta
	[FIELD.store]: TStore;								// each document needs a 'store'
	[FIELD.type]?: string;								// some documents are qualified by 'type'
	[FIELD.key]: string;									// the primary identifier
	[key: string]: any;										// additional fields specific to a 'store'
}

//	/client/_default_
export interface IPriceDefault extends IStoreMeta {
	[FIELD.key]: TPlan;
	[FIELD.type]?: TClass;
	amount: number;
}
export interface IFeeDefault extends IStoreMeta {
	[FIELD.key]: TFeeDefault;
	amount: number;												// 'topUp' or 'hold' fee
}

//	/client/price
export interface IPrice extends IStoreMeta {
	[FIELD.key]: TPlan;
	[FIELD.type]: TPrice;
	amount: number;
}

//	/client/class
export interface IClass extends IStoreMeta {
	[FIELD.key]: string;
	[FIELD.type]: TClass;
	color: string;
	desc?: string;
}

//	/client/event
export interface IEvent extends IStoreMeta {
	name: string;
	desc: string;
	class: string | string[];
}

//	/client/schedule
export interface ISchedule extends IStoreMeta {
	[FIELD.type]: TSchedule;
	day: number;
	location: string;
	start: string | Date;
}

export interface ILocation extends IStoreMeta {
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

export interface IInstructor extends IStoreMeta {
	name: string;
	link?: {
		type: string;
		[property: string]: any;
	}[];
}

//	/client/schedule
export interface IProvider extends IStoreMeta {
	[FIELD.type]: TProvider;
	prefix?: string;
	scope?: string | string[];					// if array, joinScope determines how to encode as a string
	joinScope?: string;									// what character separates the scope parameters, default ','
	params?: object;										// custom parameters

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
export interface IProfile extends IStoreMeta {
	type: TProfile;
}

export interface IProfilePlan extends IProfile {
	type: 'plan'
	plan: TPlan;
}

export interface IProfileClaim extends IProfile {
	type: 'claims'
	claims: ICustomClaims;
}