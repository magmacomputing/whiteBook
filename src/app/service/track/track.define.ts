import { FIELD } from '@dbase/data/data.define';

interface ITrackData {
	msg: string;
	data?: any[];
}

export interface ITrack {
	[FIELD.store]: 'log';
	[FIELD.type]: ETrack;
	[FIELD.uid]?: string;
	msg: string;
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
	all,
	debug,
	info,
	warn,
	error,
	fatal,
	off
}