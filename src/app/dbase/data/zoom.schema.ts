import { COLLECTION, FIELD } from './data.define';
import { ZOOM } from './zoom.define';

// import { FIELD } from '../fire/data.define';
// import { ZOOM } from './zoom.define';

export interface IZoom<T extends IJoined | ILeft | IStatus | IStarted | IEnded> {
	[FIELD.create]: string;
	[FIELD.update]: string;
	[FIELD.id]: string;
	[FIELD.store]: COLLECTION.zoom;
	[FIELD.type]?: string;
	method: string;
	baseUrl: string;
	stamp: number;
	query: Record<string, any>;
	params: Record<string, any>;
	white?: IWhite,
	track: {
		date: number;
		day: number;
		week: number;
		month: number;
	},
	body: T;
}

export interface IWhite {
	class?: string;
	alias?: string;
}

export type ILeft = {
	event: ZOOM.left;
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

export type IJoined = {
	event: ZOOM.joined;
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
			timezone: 'Australia/Sydney';
		}
	}
}

export enum MType {
	instant = 1,
	scheduled,
	recurring,
	personal,
	recurringScheduled = 8,
}

export type IStarted = {
	event: ZOOM.started;
	payload: {
		account_id: string;
		object: {
			id: string;
			uuid: string;
			host_id: string;
			topic: string;
			type: MType;
			start_time: Date;
			timezone: string;
			duration: number;
		}
	}
}

export type IEnded = {
	event: ZOOM.ended;
	payload: {
		account_id: string;
		object: {
			id: string;
			uuid: string;
			host_id: string;
			topic: string;
			type: MType;
			start_time: Date;
			end_time: Date;
			timezone: string;
			duration: number;
		}
	}
}

export type IStatus = {
	event: ZOOM.status;
	payload: {
		account_id: string;
		object: {
			date_time: Date;
			email?: string;
			id: string;
			presence_status: 'Available' | 'Away' | 'Do_Not_Disturb';
		}
	}
}

export interface IMeeting {
	uuid: string;
	meeting_id: string;
	topic?: string;
	class_name?: string;
	attend_name?: string;
	start: {
		[FIELD.id]: string;
		start_time: Date;
	},
	end?: {
		[FIELD.id]: string;
		end_time: Date;
	}
	participants: {
		participant_id: string;
		user_id: string;
		user_name: string;
		attend_name?: string;
		join: {
			[FIELD.id]: string;
			join_time: Date;
		},
		leave?: {
			[FIELD.id]: string;
			leave_time: Date;
		}
	}[]
}

export interface IZoomEnv {
	id: string;
	start: string;
	end: string;
	event: string;
}