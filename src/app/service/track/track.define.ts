import { STORE, FIELD } from '@dbase/data/data.define';

interface ITrackData {
	msg: string;
	data?: any[];
}

export interface ITrack {
	[FIELD.store]: STORE.log;
	[FIELD.type]: ETrack;
	[FIELD.uid]?: string;
	msg: string;
	level: number;
	data?: ITrackData;
	event?: object;
	memberId?: string;
	stamp: number;
	date: {										// useful for indexing
		year: number;
		month: number;
		day: number;
	}
}

export enum ETrack {
	all = 'all',
	debug = 'debug',
	info = 'info',
	warn = 'warn',
	error = 'error',
	fatal = 'fatal',
	off = 'off',
}