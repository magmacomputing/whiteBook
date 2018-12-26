import { fix } from '@lib/number.library';
import { isString, isDate, isUndefined } from '@lib/type.library';

interface IDate {													// parse a Date into components
	yy: number;															// year[4]
	mm: number;															// month; Jan=1, Dec=12
	dd: number;															// day
	ww: number;															// day-of-week; Mon=1, Sun=7
	HH: number;															// hour24
	MM: number;															// minute
	SS: number;															// second
	ts: number;															// unix timestamp
}

interface IDateKey {
	yearMonthDay: number;
	weekDay: number;
	HHmm: string;
	stamp: number;
	display: string;
	dayMonth: string;
}

export enum DATE_FMT {
	yearMonthDay = 'yearMonthDay',
	weekDay = 'weekDay',
	HHmm = 'HHmm',
	stamp = 'stamp',
	display = 'display',
	dayMonth = 'dayMonth',
};

const DATE_KEY = {
	cell: 'ddd, YYYY-MMM-DD HH:mm:ss',      // used to parse Check-In dates from a cell
	short: 'ddd, YYYY-MMM-DD',              // used when time-portion is not relevant
	display: 'YYYY-MM-DD HH:mm:ss',         // used to format a date for display
	hourMin: 'YYYY-MMM-DD HH:mm',           // used for hour-minute granularity
	human: 'ddd, DD MMM YYYY',              // more readable by Members
	yearMonth: 'YYYYMM',                    // useful for sorting by month
	yearMonthDay: 'YYYYMMDD',               // useful for sorting by date
	yearMonthSep: 'YYYY-MM',                // top-level date grouping
	yearMonthDaySep: 'YYYY-MMM-DD',         // with abbrev month-name
	yearWeek: 'GGGGWW',                     // useful for sorting by week
	dayMonthSep: 'DD-MMM',                  // useful for showing short Date, dash separator
	dayMonthSpace: 'DD MMM',                // space separator
	dayMonthYearSep: 'DD-MMM-YYYY',					// month-name
	dayMonthYear: 'DD/MM/YYYY',							// month-number
	week: 'ww',                       		  // week number, leading zero
	weekDay: 'E',                           // day of week, Mon=1
	day: 'D',                               // return the Day number
	dayZZ: 'DD',														// Day number, leading zero
	time: 'HH:mm:ss',                       // useful for showing Time
	HHmm: 'HH:mm',													// 24Hour-Minute
	stamp: 'X',                             // Unix timestamp
	ms: 'x',                       					// millisecond timestamp
	log: 'HH:mm:ss.SSS',                    // useful for reporting timestamp in Log Spreadsheet
	elapse: 'mm:ss.SSS'                     // useful for reporting duration
};

type TDate = string | number | Date;
type TMutate = 'add' | 'start' | 'end';
type TUnitTime = 'day' | 'days' | 'minute' | 'minutes' | 'hour' | 'hours';
type TUnitOffset = 'week' | 'month';
type TUnitDiff = 'years' | 'months' | 'days';

const MON = 1, SUN = 7;

const hhmm = /^\d\d:\d\d$/;								// a regex to match HH:MM
const divideBy = {												// date-offset divisors (as unix-timestamp precision)
	years: 31536000,
	months: 2628000,
	weeks: 604800,
	days: 86400,
	hours: 3600,
	minutes: 60,
	seconds: 1,
};
const weekdays = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const months = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

/** break a Date into components, plus methods to manipulate */
export const getDate = (dt?: TDate) => {
	const date = parseDate(dt);

	return {
		...date,
		add: (offset: number, unit: TUnitTime = 'minutes') => setDate('add', unit, date, offset),
		startOf: (unit: TUnitOffset = 'week') => setDate('start', unit, date),
		endOf: (unit: TUnitOffset = 'week') => setDate('end', unit, date),
		diff: (unit: TUnitDiff = 'years', dt2?: TDate) => diffDate(date, parseDate(dt2), unit),
		format: <K extends keyof IDateKey>(fmt: K) => formatDate(fmt, date) as IDateKey[K],
	}
}

/** break a Date into components, plus methods to manipulate */
const parseDate = (dt?: TDate) => {
	if (isString(dt) && hhmm.test(dt))												// if only HH:MM supplied...
		dt = new Date().toDateString() + ' ' + dt;							// current date, append time
	const date = checkDate(dt);

	let [yy, mm, dd, ww, HH, MM, SS, ts] = [
		date.getFullYear(), date.getMonth(), date.getDate(), date.getDay(),
		date.getHours(), date.getMinutes(), date.getSeconds(), Math.round(date.getTime() / 1000),
	];
	if (!ww) ww = 7;																					// ISO weekday
	mm += 1;																									// ISO month

	return { yy, mm, dd, ww, HH, MM, SS, ts } as IDate;
}

/** translate the supplied parameter into a Date */
const checkDate = (dt?: TDate) => {
	if (isUndefined(dt))
		return new Date();																			// curent datetime

	if (isDate(dt))
		return dt;																							// Date

	if (isString(dt))
		return new Date(dt);																		// parse date-string

	return new Date(dt * 1000);																// timestamp
}

/** mutate a Date */
const setDate = (mutate: TMutate, unit: TUnitTime | TUnitOffset, date: IDate, offset?: number) => {
	if (mutate !== 'add')
		[date.HH, date.MM, date.SS] = [0, 0, 0];								// discard the time-portion of the date

	switch (mutate + '.' + unit) {
		case 'start.week':
			date.dd = date.dd - date.ww + MON;
			break;
		case 'start.month':
			date.dd = 1;
			break;
		case 'end.week':
			date.dd = date.dd - date.ww + SUN;
			break;
		case 'end.month':
			date.mm += 1;
			date.dd = 0;
			break;
		case 'add.day':
		case 'add.days':
			date.dd += offset!;
			break;
		case 'add.hour':
		case 'add.hours':
			date.HH += offset!;
			break;
		case 'add.minute':
		case 'add.minutes':
			date.MM += offset!;
			break;
	}

	return getDate(new Date(date.yy, date.mm - 1, date.dd, date.HH, date.MM, date.SS));
}

/** apply some standard format rules */
const formatDate = (fmt: keyof IDateKey, date: IDate) => {
	switch (fmt) {
		case DATE_FMT.HHmm:
			return `${fix(date.HH)}:${fix(date.MM)}`;

		case DATE_FMT.yearMonthDay:
			return `${date.yy}${fix(date.mm)}${fix(date.dd)}`;

		case DATE_FMT.weekDay:
			return date.ww;

		case DATE_FMT.stamp:
			return date.ts;

		case DATE_FMT.display:
			return `${weekdays[date.ww]}, ${fix(date.dd)} ${months[date.mm]} ${date.yy}`;

		case DATE_FMT.dayMonth:
			return `${fix(date.dd)}-${months[date.mm]}`;

		default:
			return '';
	}
}

/** calculate the difference between dates */
const diffDate = (dt1: IDate, dt2: IDate, unit: TUnitDiff) =>
	Math.floor((dt2.ts - dt1.ts) / divideBy[unit]);

/** quick shortcut rather than getDate().format(stamp) */
export const getStamp = (dt?: TDate) =>
	Math.floor(checkDate(dt).getTime() / 1000);	// Unix timestamp-format
