import { ICustomClaims } from '@dbase/auth/auth.interface';
import { FIELD } from '@dbase/data/data.define';

export type TStore = 'class' | 'event' | 'price' | 'provider' | 'schedule' | 'profile' | 'attend'
type TClientDefault = 'price' | 'topUp' | 'hold';
export type TPlan = 'member' | 'casual' | 'gratis' | 'student' | 'core';
type TClass = 'full' | 'half' | 'event';
type TPrice = 'full' | 'half' | 'topUp' | 'hold';
type TProfile = 'plan' | 'claim';
type TSchedule = 'event' | 'class' | 'special'
type TProvider = 'social' | 'oauth' | 'email' | 'play' | 'phone' | 'anonymous';

// These are the meta-fields for a standard record
export interface IMeta {
	[FIELD.id]?: string;									// the _id field on the remote database
	[FIELD.effect]?: number;							// the time from which (greater-than-or-equal) this row is effective
	[FIELD.expire]?: number;							// the time before which (less-than) this row is expired, or '0' for un-expired
	[FIELD.modify]?: number;							// the time when last updated locally
	[FIELD.hidden]?: boolean;							// valid value, but not to be displayed to the client
};
export interface IStoreMeta extends IMeta {
	[FIELD.id]: string;										// override 'optional'
	store: TStore;												// each document needs a 'store'
	type?: string;												// some documents are qualified by 'type'
	[key: string]: any;										// additional fields specific to a 'store'
}

//	/client/_default_
export interface IClientDefault extends IStoreMeta {
	source: TClientDefault;								// define default values
}
export interface IPriceDefault extends IClientDefault {
	plan: TPlan;
	type: TClass;
	amount: number;
}
export interface IFeeDefault extends IClientDefault {
	amount: number;												// 'topUp' or 'hold' fee
}

//	/client/price
export interface IPrice extends IStoreMeta {
	plan: TPlan;
	amount: number;
	type: TPrice;
}

//	/client/class
export interface IClass extends IStoreMeta {
	name: string;
	color: string;
	desc?: string;
	type: TClass;
}

//	/client/event
export interface IEvent extends IStoreMeta {
	name: string;
	date: number;
}

//	/client/schedule
export interface ISchedule extends IStoreMeta {
	class: string;
	day: number;
	date: number;
	name: string;
	start: number | Date;
	type: TSchedule;
}

//	/client/schedule
export interface IProvider extends IStoreMeta {
	name: string;
	prefix?: string;
	scope?: string | string[];					// if array, joinScope determines how to encode as a string
	joinScope?: string;									// what character separates the scope parameters, default ','
	params?: object;										// custom parameters
	type: TProvider;

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

//	/member
export interface IMember extends IStoreMeta {	// general /member or /attend interface
	[FIELD.id]: string;
	uid?: string;
}

//	/member/profile
export interface IProfile extends IStoreMeta {
	type: TProfile;
}

export interface IProfilePlan extends IProfile {
	plan: TPlan;
	type: 'plan'
}

export interface IProfileClaim extends IProfile {
	claims: ICustomClaims;
	type: 'claim'
}