import { toNumeric } from '@lib/string.library';
import { isString, isDate, isUndefined } from '@lib/type.library';

interface IParse {
	yy: number;															// year[4]
	mm: number;															// month; Jan=1, Dec=12
	dd: number;															// day
	ww: number;															// day-of-week; Mon=1, Sun=7
	HH: number;															// hour24
	MM: number;															// minute
	SS: number;															// second
	ts: number;															// unix timestamp
	ms: number;															// milliseconds
	wn: string;															// week-name
	mn: string;															// month-name
}

interface IDate {
	cell: string;
	short: string;
	display: string;
	hourMin: string;
	human: string;
	yearMonth: number;
	yearMonthDay: number;
	yearMonthSep: string;
	yearMonthDaySep: string;
	yearWeek: number;
	dayMonthSep: string;
	dayMonthSpace: string;
	dayMonthYearSep: string;
	dayMonthYear: string;
	week: number;
	weekDay: number;
	day: number;
	dayZZ: string;
	time: string;
	HHmm: string;
	stamp: number;
	ms: number;
	log: string;
	elapse: string;
}

const DATE_FMT: Record<keyof IDate, string> = {
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

export enum DATE_KEY {
	yearMonthDay = 'yearMonthDay',
	weekDay = 'weekDay',
	HHmm = 'HHmm',
	stamp = 'stamp',
};

type TDate = string | number | Date;
type TDirection = 'add' |'start'|'end';
type TSetUnit = 'day' | 'days' | 'minute' | 'minutes' | 'week' | 'month';

const hhmm = /^\d\d:\d\d$/;								// a regex to match HH:MM

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

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
const setDate = (direction: TDirection, unit: TSetUnit, offset?: number, dt?: TDate) => {
	const base = getDate(dt);

	if (direction !== 'add')
		[base.HH, base.MM, base.SS] = [0, 0, 0];								// discard the time-portion of the date

	switch (direction + '.' + unit) {
		case 'start.week':
			base.dd = base.dd - base.ww + 1;
			break;
		case 'start.month':
			base.dd = 1;
			break;
		case 'end.week':
			base.dd = base.dd - base.ww + 7
			break;
		case 'end.month':
			base.mm += 1;
			base.dd = 0;
			break;
		case 'add.day':
		case 'add.days':
			base.dd += offset!;
			break;
		case 'add.hour':
		case 'add.hours':
			base.HH += offset!;
			break;
		case 'add.minute':
		case 'add.minutes':
			base.MM += offset!;
			break;
	}

	return getDate(new Date(base.yy, base.mm - 1, base.dd, base.HH, base.MM, base.SS));
}

/** break a Date into components, plus methods to manipulate */
export const getDate = (dt?: TDate) => {
	if (isString(dt) && hhmm.test(dt))												// if only HH:MM supplied...
		dt = new Date().getFullYear() + ' ' + dt;								// current year, plus time
	const base = checkDate(dt);

	let [yy, mm, dd, ww, HH, MM, SS, ts, ms, wn, mn] = [
		base.getFullYear(), base.getMonth(), base.getDate(), base.getDay(),
		base.getHours(), base.getMinutes(), base.getSeconds(), Math.round(base.getTime() / 1000), base.getTime(),
		base.toString().split(' ')[0], base.toString().split(' ')[1]
	];
	if (!ww) ww = 7;																					// ISO weekday
	mm += 1;																									// ISO month
	const obj: IParse = { yy, mm, dd, ww, HH, MM, SS, ts, ms, wn, mn };

	return {
		...obj,
		add: (offset: number, unit: 'day' | 'days' | 'minute' | 'minutes') => setDate('add', unit, offset, base),
		startOf: (unit: 'week' | 'month') => setDate('start', unit, 0, base),
		endOf: (unit: 'week' | 'month') => setDate('end', unit, 0, base),
		format: <K extends keyof IDate>(fmt: K) => formatDate(fmt, obj) as IDate[K],
		diff: (dt2: TDate, unit?: 'years' | 'months' | 'days') => diffDate(obj, getDate(dt2), unit),
	}
}

const formatDate = (fmt: keyof IDate, dt: IParse) => {
	switch (fmt) {
		case DATE_KEY.HHmm:
			return `${fix(dt.HH)}:${fix(dt.MM)}`;

		case DATE_KEY.yearMonthDay:
			return toNumeric(`${dt.yy}${fix(dt.mm)}${fix(dt.dd)}`);

		case DATE_KEY.weekDay:
			return dt.ww;

		case DATE_KEY.stamp:
			return dt.ts;

		default:
			return '';
	}
}

const diffDate = (dt1: IParse, dt2: IParse, unit: 'years' | 'months' | 'days' = 'years') => {
	const divideBy = {
		years: 31536000000,
		months: 2628000000,
		weeks: 604800000,
		days: 86400000,
		hours: 3600000,
		minutes: 60000,
		seconds: 1000
	};
	const diff = dt2.ms - dt1.ms;

	return Math.floor(diff / divideBy[unit]);
}

const fix = (nbr: number, max = 2, fill = '0') =>
	nbr.toString().padStart(max, fill);

export const getStamp = (dt?: TDate) =>
	getDate(dt).format(DATE_KEY.stamp);									// Unix timestamp-format
