import { COLOR, FIELD, STORE } from '@dbase/data.define';
import { FireDocument } from '@dbase/data.schema';

import { Instant } from '@library/instant.library';

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

export interface Event<T extends Started | Ended | Joined | Left | Status> extends FireDocument {
	[FIELD.id]: string;
	[FIELD.store]: STORE.zoom;
	[FIELD.type]: EVENT;
	[FIELD.stamp]: number;
	eventId: string;								// Cloud Functions event Id
	hook?: number;									// number of times the webhook has been sent
	head: Record<string, any>;
	body: T;
	track: {
		date: number;
		day: Instant.WEEKDAY;
		week: number;
		month: number;
	},
	white?: White;
}

export type Started = {
	event: EVENT.started;
	payload: {
		account_id: string;
		object: {
			id: string;
			uuid: string;
			host_id: string;
			topic: string;
			type: TYPE;
			start_time: Date;
			timezone: string;
			duration: number;
		}
	};
}

export type Ended = {
	event: EVENT.ended;
	payload: {
		account_id: string;
		object: {
			id: string;
			uuid: string;
			host_id: string;
			topic: string;
			type: TYPE;
			start_time: Date;
			end_time: Date;
			timezone: string;
			duration: number;
		}
	}
}

export type Joined = {
	event: EVENT.joined;
	payload: {
		account_id: string;
		object: {
			start_time: Date;
			topic: string;
			type: number;
			id: string;
			duration: number;
			uuid: string;
			host_id: string;
			participant: {
				id: string;
				join_time: Date;
				user_id: string;
				user_name: string;
			},
			timezone: string;
		}
	}
}

export type Left = {
	event: EVENT.left;
	payload: {
		account_id: string;
		object: {
			start_time: Date;
			topic: string;
			type: number;
			id: string;
			duration: number;
			uuid: string;
			host_id: string;
			participant: {
				id: string;
				leave_time: Date;
				user_id: string;
				user_name: string;
			},
			timezone: 'Australia/Sydney';
		}
	}
}

export type Status = {
	event: EVENT.status;
	payload: {
		account_id: string;
		object: {
			date_time: Date;
			email?: string;
			id: string;
			presence_status: PRESENCE;
		}
	}
}

export interface Meeting {
	uuid: string;
	meeting_id: string;
	topic?: string;
	start: {
		[FIELD.id]: string;
		[FIELD.stamp]: number;
		start_time: Date;
		label: string;							// to be displayed on an UI tab
		color?: COLOR;
		white?: White;
	},
	end?: {
		[FIELD.id]: string;
		[FIELD.stamp]: number;
		end_time: Date;
		label: string;							// to be displayed on an UI tab
	}
	participants: {
		participant_id: string;
		user_id: string;
		user_name: string;
		join: {
			[FIELD.id]: string;
			[FIELD.stamp]: number;
			join_time: Date;
			label: string;							// to be displayed on an UI tab
			white: White;
			price?: number;
			credit?: number;
			fgcolor?: {
				alias?: COLOR;
			}
			bgcolor?: {
				price?: COLOR;
				credit?: COLOR;
				bonus?: COLOR;
				priceTip?: string;
				creditTip?: string;
				bonusTip?: string;
			}
		},
		leave?: {
			[FIELD.id]: string;
			[FIELD.stamp]: number;
			leave_time: Date;
			label: string;							// to be displayed on an UI tab
		}
	}[]
}

export interface Config {
	id: string;
	start: string;
	end: string;
	event: string;
	color: COLOR;
	day?: number[];
}

export interface White {
	class?: string;
	alias?: string;
	paid?: true;
	credit?: number;
	price?: number;
	track?: {
		history: number;
	},
	history?: Record<string, any>[];
	status?: {
		lastVisit: string;
		eventType: string;
		eventPrice: string;
		eventNote?: string;
		bonus?: string;
		hr1?: string;
		creditExpires: string;
		creditRemaining: string;
		trackDaysThisWeek: number;
		_week: string;
	},
	checkIn?: {
		type: string;
		price: number;
		nextAttend: {
			row: number;
			col: number;
			spend: number;
			bank: number;
			amt: number;
			pre: number;
		}
	}
}