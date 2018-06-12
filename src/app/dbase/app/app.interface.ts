import { ICustomClaims } from '@dbase/auth/auth.interface';
import { FIELD } from '@dbase/fire/fire.define';

// These are the meta-fields for a standard record
export interface IMeta {
	[FIELD.id]?: string;
	[FIELD.effect]?: number;							// the time from which (greater-than-or-equal) this row is effective
	[FIELD.expire]?: number;							// the time before which (less-than) this row is expired, or '0' for un-expired
	[FIELD.modify]?: number;							// the time when last updated locally
};

type TAppDefault = 'price' | 'topUp' | 'hold';
export interface IAppDefault {
	type: TAppDefault;
	[FIELD.expire]?: number;
	[name: string]: any;
}
export interface IPriceDefault extends IAppDefault {
	plan: string;
	class: string;
	amount: number;
}
export interface IFeeDefault extends IAppDefault {
	plan: string;
	amount: number;												// 'topUp' or 'hold' fee
}

export interface IClient extends IMeta {
	store?: string;
}

export type TPrice = 'full' | 'half' | 'topUp' | 'hold';
export interface IPrice extends IMeta {
	plan: string;
	amount: number;
	type: TPrice;
}

export type TClass = 'full' | 'half' | 'event';
export interface IClass extends IMeta {
	name: string;
	color: string;
	type: TClass;
	desc?: string;
}

export type TProfile = 'plan' | 'claim';
export interface IProfile extends IMeta {
	type: TProfile;
}

export type TPlan = 'member' | 'casual' | 'gratis' | 'student' | 'core';
export interface IProfilePlan extends IProfile {
	plan: TPlan;
}

export interface IProfileClaim extends IProfile {
	claims: ICustomClaims;
}

export type TSchedule = 'event' | 'class' | 'special'
export interface ISchedule extends IMeta {
	class: string;
	day: number;
	time: string;
	type: TSchedule;
}

type TProvider = 'social' | 'oauth' | 'email' | 'play' | 'phone' | 'anonymous';
export interface IProvider extends IMeta {
	name: string;
	type: TProvider;
	prefix?: string;
	scope?: string | string[];					// if array, joinScope determines how to encode as a string
	joinScope?: string;									// what character separates the scope parameters, default ','
	params?: Object;										// custom parameters

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

export interface IOAuth {
	redirect_uri: string;
	request_url: string;
}