
export enum COLLECTION {
	Client = 'client',							// App details
	Member = 'member',							// Member-related details
	Attend = 'attend',							// Attendance records (per Member, per Event)
	Admin = 'admin',								// Administrator records
	Device = 'device',							// Connected Devices (per Member)
	Forum = 'forum',								// Comments / Reactions / Feedback
	Zoom = 'zoom',									// Zoom Meeting integration
	Log = 'log',										// App actions
}

export enum STORE {
	// Client
	Alert = 'alert',
	Bonus = 'bonus',
	Calendar = 'calendar',
	Class = 'class',
	Event = 'event',
	Icon = 'icon',
	Instructor = 'instructor',
	Location = 'location',
	Plan = 'plan',
	Price = 'price',
	Provider = 'provider',
	Schedule = 'schedule',
	Span = 'span',
	Default = '_default_',
	Config = '_config_',
	Schema = '_schema_',
	// Member
	Gift = 'gift',
	Diary = 'diary',
	Payment = 'payment',
	Message = 'message',
	Profile = 'profile',
	Setting = 'setting',
	Status = 'status',							// ad-hoc member documents
	// Admin
	Register = 'register',					// copy of Firestore Authentication object
	Migrate = 'migrate',						// imported event attends from Google Apps Sheets
	Sheet = 'sheet',								// imported details from Google Apps Sheets register
	// Forum
	Comment = 'comment',
	React = 'react',
	// Attend
	Attend = 'attend',
	// misc
	Local = '@config@',
	Log = 'log',
	Zoom = 'zoom',
}

export enum FIELD {								// common Field names
	Effect = '_effect',							// valid when greater-than-or-equal-to
	Expire = '_expire',							// valid when less-than
	Update = '_update',							// date-time modified
	Create = '_create',							// date-time created
	Access = '_access',							// date-time accessed
	Hidden = '_hidden',							// valid, but not displayed to User
	Hisable = '_disable',						// displayed, but greyed to User
	Id = '_id',
	Key = 'key',
	Type = 'type',
	Name = 'name',
	Store = 'store',
	Stamp = 'stamp',
	Uid = 'uid',
	Note = 'note',
	Date = 'date',
	Sort = 'sort',
	Image = 'image',
}

export enum CLASS {
	AeroStep = 'AeroStep',
	HiLo = 'HiLo',
	MultiStep = 'MultiStep',
	SingleStep = 'SingleStep',
	SmartStep = 'SmartStep',
	StepBasic = 'StepBasic',
	StepDown = 'StepDown',
	StepIn = 'StepIn',
	Zumba = 'Zumba',
	ZumbaStep = 'ZumbaStep',
	"Step@Home" = 'Step@Home',
	"Rumba@Home" = 'Rumbe@Home',
}

export enum MESSAGE {
	Diary = 'diary',
	Alert = 'alert',
}

export enum EVENT {
	closed = 'closed',
	event2 = 'Event*2',
	event3 = 'Event*3',
	evetn4 = 'Event*4',
	holiday3 = 'Holiday*3',
	stepIn2 = 'StepIn*2',
	zumba1 = 'Zumba*1',
}

export enum SCHEDULE {
	Class = 'class',
	Event = 'event',
	Special = 'special',
}

export enum PROFILE {
	Plan = 'plan',
	Claim = 'claim',
	Info = 'info',
	Pref = 'pref',
	Token = 'token',
}

export enum PLAN {
	Member = 'member',
	Casual = 'casual',
	Gratis = 'gratis',
	Student = 'student',
	Sponsor = 'sponsor',
	Senior = 'senior',
	Core = 'core',
	Intro = 'intro',
}

export enum PRICE {
	Full = 'full',
	Half = 'half',
	TopUp = 'topUp',
	Hold = 'hold',
	Home = 'home',
}

export enum PAYMENT {
	TopUp = 'topUp',
	Adjust = 'adjust',
	Hold = 'hold',
}

export enum CALENDAR {
	Once = 'once',
	Special = 'special',
}

export enum SPAN {
	Full = 'full',
	Half = 'half',
	Home = 'home',
}

export enum COLOR {
	MultiStep = '#0000ff',
	SingleStep = '#00afff',
	StepBasic = '#bf9000',
	SmartStep = '#0897a6',
	StepDown = '#cc0000',
	AeroStep = '#ff8c00',
	StepIn = '#222222',
	HiLo = '#35c42c',
	Zumba = '#ff00ff',
	ZumbaStep = '#7700ee',
	'3Pack' = '#9ba602',							// old way of recording multiple Sunday Bonus attends
	'Step@Home' = '#77aaff',
	// 'Rumba@Home' = '#bf9000',
	'Rumba@Home' = '#ac716e',
	Collection = '#4a86e8',
	Store = '#980000',
	Admin = '#38761d',

	Black = '#ffffff',
	Yellow = '#fff2cc',
	Green = '#d9ead3',
	Red = '#e6b8af',
}

export enum TRACK {
	Off = 'off',
	All = 'all',
	Debug = 'debug',
	Info = 'info',
	Warn = 'warn',
	Error = 'error',
	Fatal = 'fatal',
}

export namespace auth {
	export enum PROVIDER {
		fb = 'fb',										// Facebook
		go = 'go',										// Google
		gh = 'gh',										// GitHub
		li = 'li',										// LinkedIn
		tw = 'tw',										// Twitter
		as = 'as',										// Google Apps Script
		em = '@',											// Email/Password
		jwt = 'jwt',									// JSON Web Token 
	}

	export enum METHOD {
		Identity = 'identity',
		Oauth = 'oauth',
		Oidc = 'oidc',
		Email = 'email',
		Phone = 'phone',
		Play = 'play',
		Anonymous = 'anonymous',
		Custom = 'custom',
	}

	export enum ROLE {
		Member = 'member',
		Instructor = 'instructor',
		Admin = 'admin',
		Guest = 'guest',
	}
}

export enum STATUS {
	Connect = 'connect',						// status-document to store current connection-state
	Account = 'account',						// status-document for summary of Member's current account balance						
}

export enum CONNECT {
	Connect = 'connect',						// connected, but not logged-in
	Active = 'active',							// logged-in, browser has focus
	Behalf = 'behalf',							// logged-in on behalf of Member
	Inactive = 'inactive',					// logged-in, browser lost focus
	Offline = 'offline',						// logged-in, network off air
	Logout = 'logout',							// logged-out, browser lost focus
}

export enum BONUS {
	None = 'none',
	Gift = 'gift',
	Class = 'class',
	Week = 'week',
	Month = 'month',
	Sunday = 'sunday',
	Home = 'home',
}

export enum REACT {
	None,
	Like,
	Love,
	Wow,
	Laugh,
	Sad,
	Angry,
	Poop,
}
