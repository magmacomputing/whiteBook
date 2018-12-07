
interface ILogData {
	msg: string;
	data?: any[];
}

interface ILog {
	msg: string;
	type: keyof Console;
	data?: ILogData;
	event?: object;
	uid?: string;
	memberId?: string;
	stamp?: number;
}

export enum ELog {
	All,
	Debug,
	Info,
	Warn,
	Error,
	Fatal,
	Off
}