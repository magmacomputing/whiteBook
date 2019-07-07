export enum COLLECTION {
	log = 'log',
	member = 'member',
	attend = 'attend',
	client = 'client',
	admin = 'admin',
	device = 'device',
}

export enum STORE {
	profile = 'profile',
	payment = 'payment',
	attend = 'attend',
	provider = 'provider',
	alert = 'alert',
	class = 'class',
	event = 'event',
	price = 'price',
	plan = 'plan',
	schedule = 'schedule',
	calendar = 'calendar',
	location = 'location',
	instructor = 'instructor',
	message = 'message',
	bonus = 'bonus',
	gift = 'gift',
	span = 'span',
	default = '_default_',
	config = '_config_',
	schema = '_schema_',
	register = 'register',
	migrate = 'migrate',
	status = 'status',
	local = '@config@',
	setting = 'setting',
	react = 'react',
	log = 'log',
}

export enum TYPE {
	info = 'info',
	plan = 'plan',
	pref = 'pref',
	claim = 'claim',
	profile = 'profile',
	message = 'message',
	account = 'account',
	topUp = 'topUp',
}

export enum MEMBER {
	profile = 'profile',						// 'claims', 'info', 'plan'
	payment = 'payment',						// Payments
	diary = 'diary',								// notes from Member
	gift = 'gift',									// Gifts to Member
	status = 'status',							// online / offline status
	setting = 'setting',						// Member / device preferences
}

export enum FIELD {								// common Field names
	effect = '_effect',							// valid when greater-than-or-equal-to
	expire = '_expire',							// valid when less-than
	update = '_update',							// date-time modified
	create = '_create',							// date-time created
	access = '_access',							// date-time accessed
	hidden = '_hidden',							// valid, but not displayed to User
	disable = '_disable',						// displayed, but greyed to User
	stamp = 'stamp',
	note = 'note',
	date = 'date',
	id = '_id',
	uid = 'uid',
	store = 'store',
	type = 'type',
	icon = 'icon',
	key = 'key',
};

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
	like = 'like',
	love = 'love',
	wow = 'wow',
	laugh = 'laugh',
	sad = 'sad',
	angry = 'angry',
}