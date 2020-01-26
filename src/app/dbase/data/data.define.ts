/** The global whiteBook namespace */
export declare namespace whiteBook {

}

export enum COLLECTION {
	log = 'log',						// App actions
	member = 'member',			// Member-related details
	attend = 'attend',			// Attendance records (per Member, per Event)
	client = 'client',			// App details
	admin = 'admin',				// Administrator records
	device = 'device',			// Connected Devices (per Member)
	forum = 'forum',				// Comments / Reactions / Feedback
}

export enum STORE {
	// Client
	alert = 'alert',
	bonus = 'bonus',
	calendar = 'calendar',
	class = 'class',
	event = 'event',
	icon = 'icon',
	instructor = 'instructor',
	location = 'location',
	plan = 'plan',
	price = 'price',
	provider = 'provider',
	schedule = 'schedule',
	span = 'span',
	default = '_default_',
	config = '_config_',
	schema = '_schema_',
	// Member
	gift = 'gift',
	payment = 'payment',
	message = 'message',
	migrate = 'migrate',
	profile = 'profile',
	setting = 'setting',
	status = 'status',
	// Admin
	account = 'account',						// summary of Member's current account balance
	connect = 'connect',						// Member's connection status
	import = 'import',							// imported details from Google Apps Sheets
	register = 'register',					// copy of Firestore Authentication object
	// Forum
	comment = 'comment',
	react = 'react',
	// Attend
	attend = 'attend',
	// misc
	local = '@config@',
	log = 'log',
}

export enum TYPE {								// standard <type> field names
	claim = 'claim',
}

export enum FIELD {								// common Field names
	effect = '_effect',							// valid when greater-than-or-equal-to
	expire = '_expire',							// valid when less-than
	update = '_update',							// date-time modified
	create = '_create',							// date-time created
	access = '_access',							// date-time accessed
	hidden = '_hidden',							// valid, but not displayed to User
	disable = '_disable',						// displayed, but greyed to User
	id = '_id',
	key = 'key',
	type = 'type',
	store = 'store',
	stamp = 'stamp',
	uid = 'uid',
	note = 'note',
	date = 'date',
	sort = 'sort',
	image = 'image',
	unknown = 'unknown',
};

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
	ZumbaStep = 'ZumbaStep'
}

export enum MESSAGE {
	// diary = 'diary',
	// alert = 'alert',
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
	class = 'class',
	event = 'event',
	special = 'special',
}

export enum PROFILE {
	plan = 'plan',
	claim = 'claim',
	info = 'info',
	pref = 'pref',
}

export enum PLAN {
	member = 'member',
	casual = 'casual',
	gratis = 'gratis',
	student = 'student',
	pension = 'pension',
	core = 'core',
	intro = 'intro',
}

export enum PRICE {
	full = 'full',
	half = 'half',
	topUp = 'topUp',
	hold = 'hold',
}

export enum PAYMENT {
	credit = 'credit',
	debit = 'debit',
	topUp = 'topUp',
	hold = 'hold',
}

export enum CALENDAR {
	once = 'once',
	special = 'special',
}

export enum SPAN {
	full = 'full',
	half = 'half',
}

export namespace Auth {
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
		identity = 'identity',
		oauth = 'oauth',
		oidc = 'oidc',
		email = 'email',
		phone = 'phone',
		play = 'play',
		anonymous = 'anonymous',
		custom = 'custom',
	}

	export enum ROLE {
		member = 'member',
		instructor = 'instructor',
		admin = 'admin',
		guest = 'guest',
	}
}

export enum STATUS {
	connect = 'connect',
	account = 'account',
}

export enum CONNECT {
	connect = 'connect',						// connected, but not logged-in
	active = 'active',							// logged-in, browser has focus
	behalf = 'behalf',							// logged-in on behalf of Member
	inactive = 'inactive',					// logged-in, browser lost focus
	offline = 'offline',						// logged-in, network off air
	logout = 'logout',							// logged-out, browser lost focus
}

export enum BONUS {
	none = 'none',
	gift = 'gift',
	week = 'week',
	month = 'month',
	sunday = 'sunday',
}

export enum REACT {
	none,
	like,
	love,
	wow,
	laugh,
	sad,
	angry,
	poop,
}
