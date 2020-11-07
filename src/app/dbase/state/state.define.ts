import { Observable } from 'rxjs';

import type { AuthSlice } from './auth.action';
import type { COLLECTION, STORE, BONUS } from '@dbase/data/data.define';
import type {
	Default, ProfilePlan, ProfilePref, Price, Plan, Payment, Attend, Schedule, Class, Event, Calendar,
	Location, Instructor, ProfileInfo, FireDocument, Span, Alert, Message, Register, Schema, Config, Gift, Bonus,
	StatusConnect, StatusAccount, TBonus, Icon, Provider, React, Comment, Sheet,
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

export type TStateSlice<T> = Record<string, T[]>;
export type LState = Record<string, TStateSlice<FireDocument>>;	// localStorage State
export type OState = Observable<TStateSlice<FireDocument>>;
export type IState = Record<string, OState>;

export interface UserState {
	auth: AuthSlice;
}

export interface AdminState {
	[STORE.register]: Register[];
	[STORE.account]: StatusAccount[];
	[STORE.connect]: StatusConnect[];
	[STORE.sheet]: Sheet[];
	dash: {															// align elements of each Admin Array by UID
		[STORE.register]: Register;
		[STORE.account]?: StatusAccount;
		[STORE.connect]?: StatusConnect;
		[STORE.sheet]?: Sheet;
	}[]
}

export interface ApplicationState {		// application-wide settings
	application: {
		[STORE.default]: Default[];				// defaults to apply, if missing from Member data
		[STORE.schema]?: Schema[];
		[STORE.config]?: Config[];
	}
}

export interface MemberState extends UserState, ApplicationState {
	[COLLECTION.member]: {
		[STORE.plan]: ProfilePlan[];      // member's effective plan
		info: ProfileInfo[];             	// array of AdditionalUserInfo documents
		pref: ProfilePref[];							// member's preferences
		[STORE.message]: Message[];				// array of messages to a Member
		[STORE.gift]: Gift[];							// array of gifts for a Member
	}
}

export interface ProviderState {
	[COLLECTION.client]: {
		[STORE.provider]: Provider[];			// array of effective Provider documents
		[STORE.icon]: Icon[];							// array of Provider icons
	}
}
export interface PlanState extends MemberState {
	[COLLECTION.client]: {
		[STORE.plan]: Plan[];             // array of effective Plan documents
		[STORE.price]: Price[];						// array of effective Price documents
		[STORE.icon]: Icon[];							// array of Plan icons
	}
}

export interface BonusState extends UserState, ApplicationState {
	[COLLECTION.client]: {
		[STORE.bonus]: Bonus[];						// array of Bonus scheme rules
	}
	[COLLECTION.member]: {
		[STORE.gift]: Gift[];							// array of gifts to a Member
	}
	track: {
		[BONUS.gift]: Attend[];						// array of Attends against their gifts
		[BONUS.week]: Attend[];						// array of Attends against the current week
		[BONUS.class]: Attend[];						// array of Attends against the current week
		[BONUS.month]: Attend[];						// array of Attends against the current month
	}
}

export interface AccountState extends MemberState, PlanState {
	[STORE.account]: {
		payment: Payment[];								// array of open payment documents, sorted by <stamp>
		attend: Attend[];
		summary: StatusAccount["summary"];
	}
}

export interface AttendState {
	[payment: string]: Attend[];
}

export interface PaymentState {
	[payment: string]: Payment[];
}

export interface TimetableState extends MemberState, ApplicationState {
	[COLLECTION.client]: {
		[STORE.schedule]?: Schedule[];
		[STORE.class]?: Class[];
		[STORE.event]?: Event[];
		[STORE.calendar]?: Calendar[];
		[STORE.diary]?: Calendar[];
		[STORE.location]?: Location[];
		[STORE.instructor]?: Instructor[];
		[STORE.plan]?: Plan[];
		[STORE.price]?: Price[];
		[STORE.span]?: Span[];
		[STORE.alert]?: Alert[];
		[STORE.bonus]?: Bonus[];
		[STORE.icon]?: Icon[];
	},
	[COLLECTION.attend]: {
		attendGift: Attend[];
		attendWeek: Attend[];
		attendClass: Attend[];
		attendMonth: Attend[];
		attendToday: Attend[];
	},
	[STORE.bonus]?: TBonus,
	[COLLECTION.forum]?: ForumState["forum"];
}

export interface ForumState {
	[COLLECTION.forum]: {
		[STORE.comment]?: Comment[];
		[STORE.react]?: React[];
	}
}