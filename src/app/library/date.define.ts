import { IObject } from "@lib/object.library";

/** an array of Formats for Moment() to try against a string Date */
export const MOMENT_FMT = [
	'DD-MMM-YYYY',
];

export interface IDate {
	cell: string;
	short: string;
	display: string;
	hourMin: string;
	human: string;
	yearMonth: number;
	yearMonthDay: number;
	yearMonthFmt: string;
	yearMonthDayFmt: string;
	yearWeek: number;
	dayMonth: string;
	dayMonthFmt: string;
	week: number;
	weekDay: number;
	day: number;
	dayZZ: string;
	time: string;
	stamp: number;
	milliSecond: number;
	log: string;
	elapse: string;
}

type TDate = { [K in keyof IDate]: string; }

export const DATE_FMT: TDate = {
	cell: 'ddd, YYYY-MMM-DD HH:mm:ss',      // used to parse Check-In dates from a cell
	short: 'ddd, YYYY-MMM-DD',              // used when time-portion is not relevant
	display: 'YYYY-MM-DD HH:mm:ss',         // used to format a date for display
	hourMin: 'YYYY-MMM-DD HH:mm',           // used for hour-minute granularity
	human: 'ddd, DD MMM YYYY',              // more readable by Members
	yearMonth: 'YYYYMM',                    // useful for sorting by month
	yearMonthDay: 'YYYYMMDD',               // useful for sorting by date
	yearMonthFmt: 'YYYY-MM',                // top-level date grouping
	yearMonthDayFmt: 'YYYY-MMM-DD',         // with abbrev month-name
	yearWeek: 'GGGGWW',                     // useful for sorting by week
	dayMonth: 'DD-MMM',                     // useful for showing short Date, dash separator
	dayMonthFmt: 'DD MMM',                	// space separator
	week: 'ww',                             // week number, leading zero
	weekDay: 'd',                           // day of week, Mon=1
	day: 'D',                               // return the Day number
	dayZZ: 'DD',														// Day number, leading zero
	time: 'HH:mm:ss',                       // useful for showing Time
	stamp: 'X',                             // Unix timestamp
	milliSecond: 'x',                       // millisecond timestamp
	log: 'HH:mm:ss.SSS',                    // useful for reporting timestamp in Log Spreadsheet
	elapse: 'mm:ss.SSS'                     // useful for reporting duration
};