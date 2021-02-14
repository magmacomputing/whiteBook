import type { auth, COLLECTION, STORE, FIELD, CLASS, EVENT, CONNECT, BONUS, REACT, PLAN, PRICE, PAYMENT, PROFILE, STATUS, SCHEDULE, MESSAGE, SPAN, COLOR, TRACK, GENDER } from '@dbase/data.define';
import type { TString } from '@library/type.library';
import type { Instant } from '@library/instant.library';

export type TStoreConfig = STORE.Schema | STORE.Config | STORE.Default;
export type TStoreClient = STORE.Class | STORE.Event | STORE.Price | STORE.Plan | STORE.Provider | STORE.Schedule | STORE.Calendar | STORE.Diary | STORE.Location | STORE.Instructor | STORE.Bonus | STORE.Span | STORE.Alert | STORE.Icon;
type TStoreAdmin = STORE.Register | STORE.Sheet | STORE.Migrate;
type TStoreMember = STORE.Profile | STORE.Payment | STORE.Gift | STORE.Message | STORE.Status | STORE.Log;
type TStoreForum = STORE.React | STORE.Comment | STORE.Booking;
type TStoreAttend = STORE.Attend;

// These are the meta- and common-fields for a standard Firestore document
interface BaseDocument {
	[FIELD.Create]?: number;								// the time when first created
	[FIELD.Update]?: number;								// the time when last updated
	[FIELD.Access]?: number;								// the time when last accessed
	[FIELD.Effect]?: number;								// the time from which (greater-than-or-equal) this row is in-force
	[FIELD.Expire]?: number;								// the time before which (less-than) this row is out-of-force, or '0' | 'undefined' for open-ended

	[FIELD.Id]: string;											// the id of the document, generated by Firebase
	[FIELD.Store]: STORE;										// each document must include a 'store' field
	[FIELD.Type]?: string | number;					// an optional 'type' code to qualify the 'store'
	[FIELD.Note]?: TString;									// an optional 'note' to describe a document
}

export interface FireDocument extends BaseDocument {
	[key: string]: any;											// allow 'any' additional fields
}

/**
 * We have two main types of 'Store' documents.  
 * a) one for 'Client' & 'Local' (keyed by 'store/type?/key'),
 * b) the other for 'Admin', 'Member' & 'Attend' (keyed by 'store/type?/uid')
 * 
 * Plus a small set of miscellaneous collections;
 * a) Forum (keyed by 'store/type/uid/key')
 * b) Zoom (keyed by 'store/type')
 */
interface KeyFields extends BaseDocument {
	[FIELD.Hidden]?: boolean;								// valid value, but not to be displayed to the client
	[FIELD.Disable]?: boolean;							// valid value, greyed-out to the client
	[FIELD.Key]: string;										// primary identifier
}
interface UserFields extends BaseDocument {
	[FIELD.Uid]: string;										// all user-documents require a 'uid' field
	[FIELD.Stamp]: number;
}

export interface ClientCollection extends KeyFields {
	[FIELD.Store]: TStoreClient | TStoreConfig;
	[FIELD.Image]?: string;									// an optional icon for the UI
}
interface MemberCollection extends UserFields {			// this is the base for Member-related documents
	[FIELD.Store]: TStoreMember;
	[FIELD.Type]: PROFILE | STATUS | TRACK | MESSAGE | STORE.Event | STORE.Class;
}
interface AttendCollection extends Omit<UserFields, FIELD.Type> {
	[FIELD.Store]: TStoreAttend;
}
interface AdminCollection extends KeyFields, Omit<UserFields, FIELD.Stamp> {
	[FIELD.Store]: TStoreAdmin;
}
interface ForumCollection extends KeyFields, UserFields {
	[FIELD.Store]: TStoreForum;
	[FIELD.Type]: STORE;										// allow for Forum on any Store type
	track: {																// to use in feedback-analysis
		date: number;													// yearMonthDay
		[index: string]: string | number;			// additional info to assist tracking
	}
}

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

//	/client/_default_
export interface Default extends ClientCollection {
	[FIELD.Store]: STORE.Default;
	[FIELD.Type]: TStoreClient;							// Client store to be defaulted
}
//	/client/_config_
export interface Config extends ClientCollection {
	[FIELD.Store]: STORE.Config;
	[FIELD.Type]: string;
	value: any;
}
//	/client/_schema_
export interface Schema extends ClientCollection {
	[FIELD.Store]: STORE.Schema;
	[FIELD.Type]: COLLECTION;
	[FIELD.Key]: STORE;
	[FIELD.Sort]?: FIELD | FIELD[];
	filter?: FIELD | FIELD[];
	rules: { read: 'isAdmin' | 'isMine' | 'isAuth' | boolean }
}

//	/client/price
export interface Price extends ClientCollection {
	[FIELD.Store]: STORE.Price;
	[FIELD.Type]: PRICE;
	[FIELD.Key]: PLAN;
	amount: number;
}

//	/client/bonus
export interface Bonus extends ClientCollection {
	[FIELD.Store]: STORE.Bonus;
	[FIELD.Key]: BONUS;
	[FIELD.Sort]: number;								// sequence of processing
	free: number | CLASS | CLASS[];			// number of free classes available, or names of classes available
	level: number;											// number of classes required to attend previously, before this Bonus
	rule: TString;											// free-form text to describe the intent of the Bonus
	count?: number;											// how many times claimed
	amount?: number;										// an optional amount to apply
}

//	/client/plan
export interface Plan extends Omit<ClientCollection, FIELD.Type> {
	[FIELD.Store]: STORE.Price;
	[FIELD.Key]: PLAN;
	[FIELD.Sort]: number;
	[STORE.Bonus]?: boolean;						// allowed to claim Bonus
	hold?: number[];										// allowed to hold Expiry
	rule?: TString;											// free-form text to describe the intent of the Bonus
	expiry?: number;										// number of months after which an active Payment is auto-expired
}

//	/client/class
export interface Class extends ClientCollection {
	[FIELD.Store]: STORE.Class;
	[FIELD.Type]: SPAN;
	[FIELD.Key]: CLASS;
	color: COLOR;
}

//	/client/event
export interface Event extends ClientCollection {
	[FIELD.Store]: STORE.Event;
	[FIELD.Key]: EVENT;
	[FIELD.Name]: string;
	agenda: CLASS[];										// the Classes on offer for this Event
}

//	/client/calendar
export interface Calendar extends ClientCollection {
	[FIELD.Store]: STORE.Calendar;
	[FIELD.Type]: EVENT;
	[FIELD.Name]: string;
	day: Instant.WEEKDAY;
	start?: string;											// startTime as HH:MM
	[STORE.Location]?: string;
	[STORE.Instructor]?: string;
}

//	/client/diary
export interface Diary extends ClientCollection {
	[FIELD.Store]: STORE.Diary;					// TODO: havent decided how to use this one yet
}

//	/client/schedule
export interface TBonus {							// a sub-type of IBonus
	[FIELD.Id]: string;
	[FIELD.Type]: BONUS;
	[STORE.Gift]?: Gift[];							// the /member/gift updates for this payment
	[FIELD.Note]?: TString;							// message to Member
	count: number;											// the number of this Gift
	amount?: number;										// an optional amount (if other than $0)
}
export type TForum = {
	[STORE.Comment]?: TString;
	[STORE.React]?: REACT;
}
export interface Schedule extends ClientCollection {
	[FIELD.Store]: STORE.Schedule | STORE.Calendar;
	[FIELD.Type]: SCHEDULE;
	[FIELD.Key]: CLASS;
	day: Instant.WEEKDAY;
	location?: string;
	instructor?: string;
	start: string;											// startTime as HH:MM
	span?: SPAN;												// how long the Class runs
	price?: Price;											// the regular price detail for this class
	amount?: number;										// infer the member's price for this class
	bonus?: TBonus;											// the Bonus tracking which can be applied to this Schedule
	elect?: BONUS;											// names the Bonus the Member chooses (override calc)
	count?: number;											// number of Attends
	forum?: TForum;											// Member comment to use on their Attend of this Schedule
}

//	/client/location
interface TAddress {
	line1: string;
	line2?: string;
	line3?: string;
	suburb?: string;
	state?: string;
	postcode?: number;
}
interface TMap {
	geo?: {
		latitude: number;
		longitude: number;
	},
	link?: string;
}
export interface Location extends ClientCollection {
	[FIELD.Store]: STORE.Location;
	[FIELD.Name]: string;
	contact?: Record<string, any>,
	address?: TAddress,
	map?: TMap,
}

//	/client/instructor
export interface Instructor extends ClientCollection {
	[FIELD.Store]: STORE.Instructor;
	[FIELD.Name]: string;
	link?: {
		[FIELD.Type]: string;
		[property: string]: any;
	}[];
}

//	/client/span
export interface Span extends ClientCollection {
	[FIELD.Store]: STORE.Span;
	[FIELD.Key]: SPAN | CLASS;
	[FIELD.Type]: SCHEDULE;
	duration: number;
}

//	/client/alert									// <key> is immaterial
export interface Alert extends ClientCollection {
	[FIELD.Store]: STORE.Alert;
	[FIELD.Type]: STORE.Schedule | STORE.Event;
	[STORE.Location]?: string;
}

//	/client/icon									// icons
export interface Icon extends ClientCollection {
	[FIELD.Store]: STORE.Icon;
	[FIELD.Type]: STORE.React | STORE.Class | STORE.Event | STORE.Provider | STORE.Bonus;
	[FIELD.Key]: keyof typeof REACT | CLASS | EVENT | auth.PROVIDER | BONUS;
	[FIELD.Sort]: number;
	image: string;
}

//	/client/schedule
export interface Provider extends ClientCollection {
	[FIELD.Store]: STORE.Provider;
	[FIELD.Type]: auth.METHOD;
	[FIELD.Sort]?: number;					// list-order to display to User
	prefix?: string;
	scope?: TString;								// if array, joinScope determines how to encode as a string
	custom?: TString;								// custom OAuth parameters
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
	};
}

//	/member/message
export interface Message extends MemberCollection {
	[FIELD.Store]: STORE.Message;
	[FIELD.Type]: MESSAGE;
	[FIELD.Note]: TString;
}

//	/member/profile
export interface Profile extends MemberCollection {
	[FIELD.Store]: STORE.Profile;
	[FIELD.Type]: PROFILE;
}
export interface ProfilePlan extends Profile {
	[FIELD.Type]: PROFILE.Plan;
	[PROFILE.Plan]: PLAN;
	bump?: PLAN;												// auto-upgrade Plan on next topUp Payment
}
export interface ProfileClaim extends Profile {
	[FIELD.Type]: PROFILE.Claim;
	[PROFILE.Claim]: CustomClaims;
}
export interface ProfileInfo extends Profile {
	[FIELD.Type]: PROFILE.Info;
	[PROFILE.Info]: {										// Conformed Info across Providers
		providerId: string;
		providerUid: string;              // Provider's UserId
		firstName?: string;
		lastName?: string;
		displayName?: string;             // their Provider displayname
		email?: string;
		gender?: string;
		photoURL?: string;
		birthDate?: number;
	}
}
export interface ProfilePref extends Profile {
	[FIELD.Type]: PROFILE.Pref;
	[PROFILE.Pref]: TString;
}
export interface ProfileToken extends Profile {
	[FIELD.Type]: PROFILE.Token;
	messaging: {
		token: string;
		valid: boolean;
		error?: { code: string; message: string; };
	}[]
}

//	/member/payment
/** pay[0].type is generally the only 'topUp' */
export interface Payment extends Omit<MemberCollection, FIELD.Type> {
	[FIELD.Store]: STORE.Payment;
	bank?: number;										// un-used funds from previous payment
	expiry?: number;									// usually six-months from _effect
	pay: {
		[FIELD.Type]: PAYMENT;					// pay type
		[FIELD.Stamp]?: number;					// approval timestamp
		[FIELD.Uid]?: string;						// approver UID
		[FIELD.Note]?: TString;
		amount: number;									// pay amount
		hold?: number;									// amount of days to 'hold' expiry
	}[];
}

//	/member/gift
export interface Gift extends Omit<MemberCollection, FIELD.Type> {
	[FIELD.Store]: STORE.Gift,
	limit: number;										// number of free Attends for this Gift
	count?: number;										// number of Attends so-far for this Gift
	expiry?: number;									// optional use-by date for Gift
}

// /attend/attend
export interface Attend extends AttendCollection {
	[FIELD.Store]: STORE.Attend;
	payment: {
		[FIELD.Id]: string;							// the /member/payment _id
		amount: number;									// the amount the member was charged
	},
	timetable: {
		[FIELD.Id]: string;							// the /client/schedule or /client/event _id
		[FIELD.Store]: STORE.Schedule | STORE.Calendar;
		[FIELD.Type]: SCHEDULE;
		[FIELD.Key]: CLASS;
	}
	bonus?: {
		[FIELD.Id]: string;
		[FIELD.Type]: BONUS;
		count?: number;									// the count of this Bonus
	},
	track: {													// to use in bonus-checking, attend-analysis, etc.
		date: number;										// yearMonthDay attended
		day: Instant.WEEKDAY;						// weekDay attended (1-7, 1=Mon)
		week: number;										// yearWeek attended
		month: number;									// yearMonth attended
	},
}

//	/forum/booking									// intent to Attend, with no Payment / Bonus info
export interface Booking extends ForumCollection {
	[FIELD.Store]: STORE.Booking;
	timetable: {
		[FIELD.Id]: string;
		[FIELD.Store]: STORE.Schedule | STORE.Calendar;
		[FIELD.Type]: SCHEDULE;
		[FIELD.Key]: CLASS;
		track: {
			date: number;
			day: Instant.WEEKDAY;
			week: number;
			month: number;
		},
	};
}

//	/forum/comment
export interface Comment extends ForumCollection {
	[FIELD.Store]: STORE.Comment;
	[STORE.Comment]: TString;
	response?: {
		[FIELD.Uid]: string;
		[FIELD.Stamp]: number;
		[STORE.Comment]: TString;
		seen?: boolean;
	}[];
}

//	/forum/react
export interface React extends ForumCollection {
	[FIELD.Store]: STORE.React;
	[STORE.React]: REACT;
}

//	/admin/register
export interface CustomClaims {					// a special sub-set of fields from the User Token
	alias?: string;
	roles?: auth.ROLE[];
	allow?: string[];
	deny?: string[];
}

export interface Register extends AdminCollection {
	[FIELD.Store]: STORE.Register;
	user: firebase.default.UserInfo & {
		customClaims?: CustomClaims;
		providerData?: (firebase.default.UserInfo | null)[];
	};
}

//	/member/status
export interface Status extends MemberCollection {
	[FIELD.Store]: STORE.Status;
	[FIELD.Type]: STATUS;
}

export interface Account extends Status {
	[FIELD.Type]: STATUS.Account;
	summary: {
		bank: number;												// rollover from previous Payment
		paid: number;												// topUp amount for active Payment
		adjust: number;											// adjust amounts for active Payment
		spend: number;											// sum of Attends' amount for active Payment
		funds: number;											// active Payment credit:	bank + paid + adjust - spend

		credit: number;											// whole Account credit:	bank + paid + adjust - spend + pend
		pend: number;												// sum of not-yet-Active Payments
	};
}

export interface Connect extends Status {
	[FIELD.Type]: STATUS.Connect;
	state: CONNECT;
	device?: string | null;
}

export interface Track extends MemberCollection {
	[FIELD.Store]: STORE.Log;
	[FIELD.Type]: TRACK;
	msg: string;
	level: number;
	data?: {
		msg: string;
		data?: any[];
	};
	event?: object;
	memberId?: string;
	[FIELD.Date]: {												// useful for indexing
		year: number;
		month: number;
		day: number;
	}
}

export interface Sheet extends AdminCollection {
	[FIELD.Store]: STORE.Sheet;						// record of Google Sheet on migrated member
	credit: number;
	email: string;
	picture: string;
	plan: string;
	sheetName: string;
	userName: string;
	providers: {
		id: string;
		provider: auth.PROVIDER;
		firstName: string;
		lastName: string;
		userName: string;
		email: string;
		photoURL?: string;
		gender?: GENDER;
		isAdmin?: false;
		birthDate?: number;
	}[];
}

export interface Migrate extends AdminCollection {	// these allow for reconciliation of migrated event
	[FIELD.Store]: STORE.Migrate;
	[FIELD.Type]: STORE.Event | STORE.Class;
	[COLLECTION.Attend]: {
		[order: string]: CLASS;
	}
}
