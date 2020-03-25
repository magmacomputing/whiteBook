import { Observable } from 'rxjs';

import { IAuthState } from './auth.action';
import { STORE, BONUS, COLLECTION } from '@dbase/data/data.define';
import {
	IDefault, IProfilePlan, IProfilePref, IPrice, IPlan, IPayment, IAttend, ISchedule, IClass, IEvent, ICalendar,
	ILocation, IInstructor, IProfileInfo, IStoreMeta, ISpan, IAlert, IMessage, IRegister, ISchema, IConfig, IGift, IBonus,
	IStatusConnect, IStatusAccount, TBonus, IIcon, IProvider, IReact, IComment, IImport, ISummary,
} from '@dbase/data/data.schema';

export enum SLICE {
	root = 'root',
	client = 'client',
	auth = 'auth',
	member = 'member',
	attend = 'attend',
	admin = 'admin',
	device = 'device',
	forum = 'forum',
}

/**
 * State contains a copy of remote documents, sliced into distinct 'segment' objects.  
 * For example:  
 * >client: {                                	// Client slice, holds public data  
 * >	class: [ {class documents} ],       		// Class store, holds documents that describe classes  
 * > 	price: [ {price documents} ],      			// Price store, holds documents that describe pricing structure  
 * >		...  
 * >	},  
 * >member: {																	// Member slice, keyed by User.uid  
 * > 	profile: [ {profile documents} ],   		// Plan, Claims, User, etc.  
 * >	payment: [ {payment documents} ],   		// describe payments  
 * > },  
 * >attend: {																	// Attend slice, keyed by User.uid, linked to /member/payment documents  
 * >	{paymentId}: [ {attendance documents} ],// hold a number of Attendances against a particular account-payment  
 * }  
 */

export type TStateSlice<T> = { [segment: string]: T[] };
export interface LState { [slice: string]: TStateSlice<IStoreMeta> };	// localStore State
export interface IState { [slice: string]: Observable<TStateSlice<IStoreMeta>> };

export interface IUserState {
	auth: IAuthState;
}

export interface IAdminState {
	[STORE.register]: IRegister[];
	[STORE.account]: IStatusAccount[];
	[STORE.connect]: IStatusConnect[];
	[STORE.import]: IImport[];
	dash: {																// align elements of each Admin Array by UID
		[STORE.register]: IRegister;
		[STORE.account]?: IStatusAccount;
		[STORE.connect]?: IStatusConnect;
		[STORE.import]?: IImport;
	}[]
}

export interface IApplicationState {		// application-wide settings
	application: {
		[STORE.default]: IDefault[];        // defaults to apply, if missing from Member data
		[STORE.schema]?: ISchema[];
		[STORE.config]?: IConfig[];
	}
}

export interface IMemberState extends IUserState, IApplicationState {
	[COLLECTION.member]: {
		[STORE.plan]: IProfilePlan[];       // member's effective plan
		info: IProfileInfo[];             	// array of AdditionalUserInfo documents
		pref: IProfilePref[];								// member's preferences
		[STORE.message]: IMessage[];				// array of messages to a Member
		[STORE.gift]: IGift[];							// array of gifts for a Member
	}
}

export interface IProviderState {
	[COLLECTION.client]: {
		[STORE.provider]: IProvider[];			// array of effective Provider documents
		[STORE.icon]: IIcon[];							// array of Provider icons
	}
}
export interface IPlanState extends IMemberState {
	[COLLECTION.client]: {
		[STORE.plan]: IPlan[];              // array of effective Plan documents
		[STORE.price]: IPrice[];						// array of effective Price documents
		[STORE.icon]: IIcon[];							// array of Plan icons
	}
}

export interface IBonusState extends IUserState, IApplicationState {
	[COLLECTION.client]: {
		[STORE.bonus]: IBonus[];						// array of Bonus scheme rules
	}
	[COLLECTION.member]: {
		[STORE.gift]: IGift[];							// array of gifts to a Member
	}
	track: {
		[BONUS.gift]: IAttend[];						// array of Attends against their gifts
		[BONUS.week]: IAttend[];						// array of Attends against the current week
		[BONUS.class]: IAttend[];						// array of Attends against the current week
		[BONUS.month]: IAttend[];						// array of Attends against the current month
	}
}

export interface IAccountState extends IMemberState, IPlanState {
	[STORE.account]: {
		payment: IPayment[];								// array of open payment documents, sorted by <stamp>
		attend: IAttend[];
		summary: ISummary;
	}
}

export interface IAttendState {
	[payment: string]: IAttend[];
}

export interface IPaymentState {
	[payment: string]: IPayment[];
}

export interface ITimetableState extends IMemberState, IApplicationState {
	[COLLECTION.client]: {
		[STORE.schedule]?: ISchedule[];
		[STORE.class]?: IClass[];
		[STORE.event]?: IEvent[];
		[STORE.calendar]?: ICalendar[];
		[STORE.diary]?: ICalendar[];
		[STORE.location]?: ILocation[];
		[STORE.instructor]?: IInstructor[];
		[STORE.plan]?: IPlan[];
		[STORE.price]?: IPrice[];
		[STORE.span]?: ISpan[];
		[STORE.alert]?: IAlert[];
		[STORE.bonus]?: IBonus[];
		[STORE.icon]?: IIcon[];
	},
	[COLLECTION.attend]: {
		attendGift: IAttend[];
		attendWeek: IAttend[];
		attendClass: IAttend[];
		attendMonth: IAttend[];
		attendToday: IAttend[];
	},
	[STORE.bonus]?: TBonus,
	[COLLECTION.forum]?: IForumState["forum"];
}

export interface IForumState {
	[COLLECTION.forum]: {
		[STORE.comment]?: IComment[];
		[STORE.react]?: IReact[];
	}
}