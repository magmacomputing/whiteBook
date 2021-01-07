import { Observable } from 'rxjs';

import type { AuthSlice } from './auth.action';
import type { COLLECTION, STORE, BONUS, STATUS, PROFILE } from '@dbase/data.define';
import type {
	Default, ProfilePlan, ProfilePref, Price, Plan, Payment, Attend, Schedule, Class, Event, Calendar,
	Location, Instructor, ProfileInfo, FireDocument, Span, Alert, Message, Register, Schema, Config, Gift, Bonus,
	Connect, Account, Icon, Provider, React, Comment, Sheet, Diary, Migrate, ProfileClaim,
} from '@dbase/data.schema';

export enum SLICE {
	root = 'root',
	client = 'client',
	auth = 'auth',
	member = 'member',
	attend = 'attend',
	admin = 'admin',
	device = 'device',
	forum = 'forum',
	stage = 'stage',
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
 * > 	profile: [ {profile documents} ],   		// Plan, CustomClaim, Info, etc.  
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
	[STORE.Register]: Register[];
	[STATUS.Account]: Account[];
	[STATUS.Connect]: Connect[];
	[STORE.Sheet]: Sheet[];
	dash: {															// align elements of each Admin Array by UID
		[STORE.Register]: Register;
		[STATUS.Account]?: Account;
		[STATUS.Connect]?: Connect;
		[STORE.Sheet]?: Sheet;
	}[]
}

export interface ClientState {
	[COLLECTION.Client]: {
		[STORE.Class]?: Class[];
		[STORE.Calendar]?: Calendar[];
		[STORE.Event]?: Event[];
		[STORE.Schedule]?: Schedule[];
		[STORE.Provider]?: Provider[];
		[STORE.Diary]?: Diary[];
		[STORE.Location]?: Location[];
		[STORE.Instructor]?: Instructor[];
		[STORE.Plan]?: Plan[];
		[STORE.Price]?: Price[];
		[STORE.Span]?: Span[];
		[STORE.Alert]?: Alert[];
		[STORE.Bonus]?: Bonus[];
		[STORE.Icon]?: Icon[];
	}

}
export interface ApplicationState {		// application-wide settings
	application: {
		[STORE.Default]: Default[];				// defaults to apply, if missing from Member data
		[STORE.Schema]?: Schema[];
		[STORE.Config]?: Config[];
	}
}

export interface MemberState extends UserState, ApplicationState {
	[COLLECTION.Member]: {
		[PROFILE.Plan]: ProfilePlan[];    // member's effective plan
		[PROFILE.Info]: ProfileInfo[];    // array of AdditionalUserInfo documents
		[PROFILE.Pref]: ProfilePref[];		// member's preferences
		[PROFILE.Claim]: ProfileClaim[];	// member's CustomClaims
		[STORE.Message]: Message[];				// array of messages to a Member
		[STORE.Gift]: Gift[];							// array of gifts for a Member
	}
}

export interface ProviderState {
	[COLLECTION.Client]: {
		[STORE.Provider]: Provider[];			// array of effective Provider documents
		[STORE.Icon]: Icon[];							// array of Provider icons
	}
}
export interface PlanState extends MemberState {
	[COLLECTION.Client]: {
		[STORE.Plan]: Plan[];             // array of effective Plan documents
		[STORE.Price]: Price[];						// array of effective Price documents
		[STORE.Icon]?: Icon[];						// array of Plan icons
	}
}

export interface BonusState extends UserState, ApplicationState {
	[COLLECTION.Client]: {
		[STORE.Bonus]: Bonus[];						// array of Bonus scheme rules
	}
	[COLLECTION.Member]: {
		[STORE.Gift]: Gift[];							// array of gifts to a Member
	}
	track: {
		[BONUS.Gift]: Attend[];						// array of Attends against their gifts
		[BONUS.Week]: Attend[];						// array of Attends against the current week
		[BONUS.Class]: Attend[];					// array of Attends against the current week
		[BONUS.Month]: Attend[];					// array of Attends against the current month
	}
}

export interface AccountState extends MemberState, PlanState {
	[STATUS.Account]: {
		payment: Payment[];								// array of open payment documents, sorted by <stamp>
		attend: Attend[];
		summary: Account["summary"];
	}
}

export interface AttendState {
	[payment: string]: Attend[];
}

export interface PaymentState {
	[payment: string]: Payment[];
}

export interface TimetableState extends ApplicationState, ClientState, MemberState, ForumState {
	[COLLECTION.Attend]: {
		attendGift: Attend[];
		attendWeek: Attend[];
		attendClass: Attend[];
		attendMonth: Attend[];
		attendToday: Attend[];
	},
}

export interface ForumState {
	[COLLECTION.Forum]: {
		[STORE.Comment]?: Comment[];
		[STORE.React]?: React[];
	}
}

export interface StageState {
	[COLLECTION.Stage]: {
		[STORE.Migrate]: Migrate[];
	}
}