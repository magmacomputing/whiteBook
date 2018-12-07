
interface ITrackData {
	msg: string;
	data?: any[];
}

export interface ITrack {
	store: 'log';
	type: ETrack;
	msg: string;
	data?: ITrackData;
	event?: object;
	uid?: string;
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