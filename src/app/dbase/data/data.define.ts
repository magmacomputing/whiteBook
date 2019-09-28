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
	provider = 'provider',
	alert = 'alert',
	class = 'class',
	event = 'event',
	price = 'price',
	plan = 'plan',
	icon = 'icon',
	schedule = 'schedule',
	calendar = 'calendar',
	location = 'location',
	instructor = 'instructor',
	bonus = 'bonus',
	span = 'span',
	// Member
	profile = 'profile',
	payment = 'payment',
	setting = 'setting',
	migrate = 'migrate',
	message = 'message',
	status = 'status',
	gift = 'gift',
	// Admin
	default = '_default_',
	config = '_config_',
	schema = '_schema_',
	register = 'register',
	// Forum
	comment = 'comment',
	react = 'react',
	// Attend
	attend = 'attend',
	// misc
	log = 'log',
	local = '@config@',
}

export enum FIELD {								// common Field names
	effect = '_effect',							// valid when greater-than-or-equal-to
	expire = '_expire',							// valid when less-than
	update = '_update',							// date-time modified
	create = '_create',							// date-time created
	access = '_access',							// date-time accessed
	hidden = '_hidden',							// valid, but not displayed to User
	disable = '_disable',						// displayed, but greyed to User
	unknown = 'unknown',
	stamp = 'stamp',
	note = 'note',
	date = 'date',
	id = '_id',
	uid = 'uid',
	store = 'store',
	sort = 'sort',
	type = 'type',
	image = 'image',
	key = 'key',
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
	diary = 'diary',
	alert = 'alert',
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
		as = 'gapps',									// Google Apps Script
	}
	export enum METHOD {
		identity = 'identity',
		oauth = 'oauth',
		oidc = 'oidc',
		email = 'email',
		phone = 'phone',
		play = 'play',
		anonymous = 'anonymous',
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
	gift = 'gift',
	week = 'week',
	month = 'month',
	sunday = 'sunday',
	none = 'none',
}

export enum REACT {
	none,
	like,
	love,
	wow,
	laugh,
	sad,
	angry,
}
