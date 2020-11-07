
export enum COLLECTION {
	client = 'client',							// App details
	member = 'member',							// Member-related details
	attend = 'attend',							// Attendance records (per Member, per Event)
	admin = 'admin',								// Administrator records
	device = 'device',							// Connected Devices (per Member)
	forum = 'forum',								// Comments / Reactions / Feedback
	zoom = 'zoom',									// Zoom Meeting integration
	log = 'log',										// App actions
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
	diary = 'diary',
	payment = 'payment',
	message = 'message',
	profile = 'profile',
	setting = 'setting',
	status = 'status',							// ad-hoc member documents
	// Admin
	register = 'register',					// copy of Firestore Authentication object
	migrate = 'migrate',						// imported event attends from Google Apps Sheets
	sheet = 'sheet',								// imported details from Google Apps Sheets register
	// Forum
	comment = 'comment',
	react = 'react',
	// Attend
	attend = 'attend',
	// misc
	local = '@config@',
	log = 'log',
	zoom = 'zoom',
}

export enum TYPE {								// standard <type> field names
	claim = 'claim',
	info = 'info',
	token = 'token',
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
	name = 'name',
	store = 'store',
	stamp = 'stamp',
	uid = 'uid',
	note = 'note',
	date = 'date',
	sort = 'sort',
	image = 'image',
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
	ZumbaStep = 'ZumbaStep',
	"Step@Home" = 'Step@Home',
	"Rumba@Home" = 'Rumbe@Home',
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
	token = 'token',
}

export enum PLAN {
	member = 'member',
	casual = 'casual',
	gratis = 'gratis',
	student = 'student',
	sponsor = 'sponsor',
	senior = 'senior',
	core = 'core',
	intro = 'intro',
}

export enum PRICE {
	full = 'full',
	half = 'half',
	topUp = 'topUp',
	hold = 'hold',
	home = 'home',
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
	home = 'home',
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
	collection = '#4a86e8',
	store = '#980000',
	admin = '#38761d',

	black = '#ffffff',
	yellow = '#fff2cc',
	green = '#d9ead3',
	red = '#e6b8af',
}

export enum TRACK {
	all = 'all',
	debug = 'debug',
	info = 'info',
	warn = 'warn',
	error = 'error',
	fatal = 'fatal',
	off = 'off',
}

export namespace Zoom {
	export enum EVENT {
		type = 'body.event',
		joined = 'meeting.participant_joined',
		left = 'meeting.participant_left',
		started = 'meeting.started',
		ended = 'meeting.ended',
		status = 'user.presence_status_updated',
	}

	export enum TYPE {
		instant = 1,
		scheduled,
		recurring,
		personal,
		recurringScheduled = 8,
	}

	export enum PRESENCE {
		available = 'Available',
		away = 'Away',
		disturb = 'Do Not Disturb',
	}
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
	connect = 'connect',						// status-document to store current connection-state
	account = 'account',						// status-document for summary of Member's current account balance						
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
	class = 'class',
	week = 'week',
	month = 'month',
	sunday = 'sunday',
	home = 'home',
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
