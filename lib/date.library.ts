import { fix } from '@lib/number.library';
import { isString, isNumber, getType } from '@lib/type.library';

interface IDate {													// Date components
	yy: number;															// year[4]
	mm: number;															// month; Jan=1, Dec=12
	dd: number;															// day; 1-31
	ww: number;															// weekday; Mon=1, Sun=7
	HH: number;															// hour[24]
	MI: number;															// minute
	SS: number;															// second
	ts: number;															// unix timestamp
}

interface IDateFmt {
	yearMonthDay: number;
	weekDay: number;
	HHmm: string;
	stamp: number;
	display: string;
	dayMonth: string;
	dateTime: string;
}

export enum DAY { Mon = 1, Tue, Wed, Thu, Fri, Sat, Sun }
export enum MONTH { Jan = 1, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec }
export enum DATE_FMT {
	yearMonthDay = 'yearMonthDay',
	weekDay = 'weekDay',
	HHmm = 'HHmm',
	stamp = 'stamp',
	display = 'display',
	dayMonth = 'dayMonth',
	dateTime = 'dateTime',
}

export type TDate = string | number | Date;
type TMutate = 'add' | 'start' | 'end';
type TUnitTime = 'month' | 'months' | 'day' | 'days' | 'minute' | 'minutes' | 'hour' | 'hours';
type TUnitOffset = 'week' | 'month';
type TUnitDiff = 'years' | 'months' | 'days';

const hhmm = /^\d\d:\d\d$/;									// regex to match HH:MM
const yyyymmdd = /^(19\d{2}|20\d{2})(0[1-9]|1[012])(0[1-9]|[12][0-9]|3[01])$/;	// regex to match YYYYMMDD
const divideBy = {													// approx date-offset divisors (unix-timestamp precision)
	years: 31536000,
	months: 2628000,
	weeks: 604800,
	days: 86400,
	hours: 3600,
	minutes: 60,
	seconds: 1,
}
// High-date / Low-Dates
const maxTS = new Date('9999-12-31').valueOf() / 1000;
const minTS = new Date('1000-01-01').valueOf() / 1000;
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

/** parse a Date, return components and methods */
export class Instant {
	date: IDate;

	constructor(dt?: TDate) { this.date = parseDate(dt); }

	format<K extends keyof IDateFmt>(fmt: K) { return formatDate(fmt, this.date) as IDateFmt[K] }
	diff(unit: TUnitDiff = 'years', dt2?: TDate) { return diffDate(this.date, parseDate(dt2), unit) }
	add(offset: number, unit: TUnitTime = 'minutes') { return setDate('add', unit, this.date, offset) }
	startOf(unit: TUnitOffset = 'week') { return setDate('start', unit, this.date) }
	endOf(unit: TUnitOffset = 'week') { return setDate('end', unit, this.date) }
	isValid() { return !isNaN(this.date.ts) }
}

/** shortcut functions to common DateTime properties / methods */
export const newDate = (dt?: TDate) => new Instant(dt);
export const getDate = (dt?: TDate) => new Instant(dt).date;
export const getStamp = (dt?: TDate) => new Instant(dt).date.ts;
export const fmtDate = (fmt: keyof IDateFmt, dt?: TDate) => new Instant(dt).format(fmt);

/** break a Date into components */
const parseDate = (dt?: TDate) => {
	if (isString(dt) && hhmm.test(dt))												// if only HH:MM supplied...
		dt = new Date().toDateString() + ' ' + dt;							// 	prepend current date
	if (isString(dt) && yyyymmdd.test(dt))										// if yyyymmdd supplied as string...
		dt = dt.replace(yyyymmdd, '$1-$2-$3 00:00:00');					//  format to look like a date-string
	if (isNumber(dt) && yyyymmdd.test(dt.toString()))					// if yyyymmdd supplied as number...
		dt = dt.toString().replace(yyyymmdd, '$1-$2-$3 00:00:00');

	let date: Date;
	switch (getType(dt)) {																		// translate supplied parameter into a Date
		case 'Undefined': date = new Date(); break;
		case 'Date': date = dt as Date; break;
		case 'String': date = new Date(dt as string); break;		// attempt to parse date-string
		case 'Number':
			const nbr = dt as number;
			const val = (nbr < maxTS ? nbr * 1000 : nbr);
			date = new Date(val);
			break;																								// assume timestamp to milliseconds
		default: date = new Date();															// unexpected input
	}
	if (isNaN(date.getTime()))
		console.log('Invalid Date: ', dt, date);								// log the Invalid Date

	let [yy, mm, dd, ww, HH, MI, SS, ts] = [
		date.getFullYear(), date.getMonth(), date.getDate(), date.getDay(),
		date.getHours(), date.getMinutes(), date.getSeconds(), Math.round(date.getTime() / 1000),
	];
	if (!ww && !isNaN(ww)) ww = DAY.Sun;											// ISO weekday
	mm += 1;																									// ISO month

	return { yy, mm, dd, ww, HH, MI, SS, ts } as IDate;
}

/** calculate a Date mutation */
const setDate = (mutate: TMutate, unit: TUnitTime | TUnitOffset, date: IDate, offset?: number) => {
	if (mutate !== 'add')
		[date.HH, date.MI, date.SS] = [0, 0, 0];								// discard the time-portion of the date

	switch (`${mutate}.${unit}`) {
		case 'start.week':
			date.dd = date.dd - date.ww + DAY.Mon;
			break;
		case 'start.month':
			date.dd = 1;
			break;
		case 'end.week':
			date.dd = date.dd - date.ww + DAY.Sun;
			break;
		case 'end.month':
			date.mm += 1;
			date.dd = 0;
			break;
		case 'add.month':
		case 'add.months':
			date.mm += offset!;
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
			date.MI += offset!;
			break;
	}

	return newDate(new Date(date.yy, date.mm - 1, date.dd, date.HH, date.MI, date.SS));
}

/** apply some standard format rules */
const formatDate = (fmt: keyof IDateFmt, date: IDate) => {
	switch (fmt) {
		case DATE_FMT.HHmm:
			return `${fix(date.HH)}:${fix(date.MI)}`;

		case DATE_FMT.yearMonthDay:
			return parseInt(`${date.yy}${fix(date.mm)}${fix(date.dd)}`, 10);

		case DATE_FMT.weekDay:
			return date.ww;

		case DATE_FMT.stamp:
			return date.ts;

		case DATE_FMT.display:
			return `${DAY[date.ww]}, ${fix(date.dd)} ${MONTH[date.mm]} ${date.yy}`;

		case DATE_FMT.dayMonth:
			return `${fix(date.dd)}-${MONTH[date.mm]}`;

		case DATE_FMT.dateTime:
			return `${date.yy}-${MONTH[date.mm]}-${fix(date.dd)} ${fix(date.HH)}:${fix(date.MI)}`;

		default:
			return '';
	}
}

/** calculate the difference between dates */
const diffDate = (dt1: IDate, dt2: IDate, unit: TUnitDiff) =>
	Math.floor((dt2.ts - dt1.ts) / divideBy[unit]);

// old format codes
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