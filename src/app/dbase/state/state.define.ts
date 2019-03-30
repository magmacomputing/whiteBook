import { Observable } from 'rxjs';

import { IAuthState } from './auth.action';
import { STORE } from '@dbase/data/data.define';
import {
	IDefault, IProfilePlan, IProfilePref, IPrice, IPlan, IPayment, IAttend, ISchedule, IClass, IEvent, ICalendar,
	ILocation, IInstructor, IProfileInfo, IStoreMeta, ISpan, IAlert, IMessage, IRegister, ISchema, IConfig
} from '@dbase/data/data.schema';

export enum SLICE {
	root = 'root',
	client = 'client',
	auth = 'auth',
	member = 'member',
	attend = 'attend',
	admin = 'admin',
	local = 'local',
}

/**
 * State contains a copy of remote documents, sliced into distinct 'store' objects.
 * For example:
 * client: {                                // Client slice, holds public data
 * 		class: [ {class documents} ],       	// Class store, holds documents that describe classes
 *  	price: [ {price documents} ],      		// Price store, holds documents that describe pricing structure
 * 		...
 * 	},
 * member: {																// Member slice, keyed by User.uid
 *      profile: [ {profile documents} ],   // Plan, Claims, User, etc.
 *      payment: [ {payment documents} ],   // describe payments
 *  },
 * attend: {																// Attend slice, keyed by User.uid, linked to /member/payment documents
 *      {paymentId}: [ {attendance documents} ],// hold a number of Attendances against a particular account-payment
 *  }
 */

export type TStateSlice<T> = { [store: string]: T[] };
export interface LState { [slice: string]: TStateSlice<IStoreMeta> };	// localStore State
export interface IState { [slice: string]: Observable<TStateSlice<IStoreMeta>> };

export interface IUserState {
	auth: IAuthState;
}

export interface IAdminState {
	register: IRegister[];								// register collection
}

export interface IApplicationState {		// application-wide settings
	application: {
		[STORE.default]: IDefault[];        // defaults to apply, if missing from Member data
		[STORE.schema]?: ISchema[];
		[STORE.config]?: IConfig[];
	}
}

export interface IMemberState extends IUserState, IApplicationState {
	member: {
		plan: IProfilePlan[];             	// member's effective plan
		info: IProfileInfo[];             	// array of AdditionalUserInfo documents
		pref: IProfilePref[];								// member's preferences
		message: IMessage[];								// array of messages to a Member
	}
}

export interface IPlanState extends IMemberState {
	client: {
		plan: IPlan[];                      // array of effective Plan documents
		price: IPrice[];                    // array of effective Price documents
	}
}

export interface IAccountState extends IMemberState, IPlanState {
	account: {
		payment: IPayment[];								// array of open payment documents, sorted by <stamp>
		attend: IAttend[];
		summary: {
			paid: number;
			bank: number;
			pend: number;
			spend: number;
		};
	}
}

export interface IAttendState {
	[payment: string]: IAttend[];
}

export interface IPaymentState {
	[payment: string]: IPayment[];
}

export interface ITimetableState extends IMemberState, IApplicationState {
	client: {
		schedule?: ISchedule[];
		class?: IClass[];
		event?: IEvent[];
		calendar?: ICalendar[];
		location?: ILocation[];
		instructor?: IInstructor[];
		price?: IPrice[];
		span?: ISpan[];
		alert?: IAlert[];
	}
}