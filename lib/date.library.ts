import { fix } from '@lib/number.library';
import { isString, isNumber, getType } from '@lib/type.library';

interface IInstant {													// Date components
	yy: number;															// year[4]
	mm: number;															// month; Jan=1, Dec=12
	mn: string;															// short month-name
	dd: number;															// day; 1-31
	dn: string;															// short day-name
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

export enum DATE_FMT {
	yearMonthDay = 'yearMonthDay',
	weekDay = 'weekDay',
	HHmm = 'HHmm',
	stamp = 'stamp',
	display = 'display',
	dayMonth = 'dayMonth',
	dateTime = 'dateTime',
}

export enum DAY { Mon = 1, Tue, Wed, Thu, Fri, Sat, Sun }
export enum MONTH { Jan = 1, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec }
export type TDate = string | number | Date | Instant;
type TMutate = 'add' | 'start' | 'end';
type TUnitTime = 'month' | 'months' | 'day' | 'days' | 'minute' | 'minutes' | 'hour' | 'hours';
type TUnitOffset = 'day' | 'week' | 'month';
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

/** shortcut functions to common Instant class properties / methods */
const isInstant = (dt?: TDate): dt is Instant => getType(dt) === 'Instant';
/** get new Instant */export const getDate = (dt?: TDate) => new Instant(dt);
/** get ms Timestamp*/export const getStamp = (dt?: TDate) => (isInstant(dt) ? dt : new Instant(dt)).ts;
/** format a Date */	export const fmtDate = <K extends keyof IDateFmt>(fmt: K, dt?: TDate) => (isInstant(dt) ? dt : new Instant(dt)).format(fmt);

/** parse a Date, return components and methods */
class Instant {
	private date: IInstant;

	constructor(dt?: TDate) { this.date = this.parseDate(dt); }

/** 4-digit year */		get yy() { return this.date.yy }
/** month number */		get mm() { return this.date.mm }
/** short month name*/get mn() { return this.date.mn }
/** day number */			get dd() { return this.date.dd }
/** short day name */	get dn() { return this.date.dn }
/** 24-hour format */	get HH() { return this.date.HH }
/** minute */					get MM() { return this.date.MI }
/** minute */					get MI() { return this.date.MI }
/** seconds */				get SS() { return this.date.SS }
/** weekday number */	get ww() { return this.date.ww }
/** unix timestamp */	get ts() { return this.date.ts }

/** apply formatting*/format = <K extends keyof IDateFmt>(fmt: K) => this.formatDate(fmt);
/** calc diff Dates */diff = (unit: TUnitDiff = 'years', dt2?: TDate) => this.diffDate(dt2, unit);
/** add date offset */add = (offset: number, unit: TUnitTime = 'minutes') => this.setDate('add', unit, offset);
/** start offset */		startOf = (unit: TUnitOffset = 'week') => this.setDate('start', unit);
/** ending offset */	endOf = (unit: TUnitOffset = 'week') => this.setDate('end', unit);
/** is Instant valid*/isValid = () => !isNaN(this.date.ts);

	/** break a Date into components */
	private parseDate = (dt?: TDate) => {
		if (isString(dt) && hhmm.test(dt))												// if only HH:MM supplied...
			dt = new Date().toDateString() + ' ' + dt;							// 	prepend current date
		if (isString(dt) && yyyymmdd.test(dt))										// if yyyymmdd supplied as string...
			dt = dt.replace(yyyymmdd, '$1-$2-$3 00:00:00');					//  format to look like a date-string
		if (isNumber(dt) && yyyymmdd.test(dt.toString()))					// if yyyymmdd supplied as number...
			dt = dt.toString().replace(yyyymmdd, '$1-$2-$3 00:00:00');

		let date: Date;
		switch (getType(dt)) {																		// translate supplied parameter into a Date
			case 'Undefined':																				// set to 'now'
				date = new Date();
				break;
			case 'Date':																						// already a valid Date
				date = dt as Date;
				break;
			case 'Instant':																					// turn Instant back into a date-string
				date = new Date((dt as Instant).format(DATE_FMT.dateTime));
				break;
			case 'String':
				date = new Date(dt as string);												// attempt to parse date-string
				break;
			case 'Number':																					// check whether milliseconds or microseconds
				const nbr = dt as number;
				const val = (nbr < maxTS ? nbr * 1000 : nbr);					// assume timestamp to milliseconds
				date = new Date(val);
				break;
			default:																								// unexpected input
				date = new Date();
		}
		if (isNaN(date.getTime()))
			console.log('Invalid Date: ', dt, date);								// log the Invalid Date

		let [yy, mm, dd, ww, HH, MI, SS, ts] = [
			date.getFullYear(), date.getMonth(), date.getDate(), date.getDay(),
			date.getHours(), date.getMinutes(), date.getSeconds(), Math.round(date.getTime() / 1000),
		];
		if (!ww && !isNaN(ww)) ww = DAY.Sun;											// ISO weekday
		mm += 1;																									// ISO month

		return { yy, mm, dd, ww, HH, MI, SS, ts, mn: MONTH[mm], dn: DAY[ww] } as IInstant;
	}

	/** mutate an Instant */
	private setDate = (mutate: TMutate, unit: TUnitTime | TUnitOffset, offset?: number) => {
		const date = { ...this.date };														// clone the current Instant
		if (mutate !== 'add')
			[date.HH, date.MI, date.SS] = [0, 0, 0];								// discard the time-portion of the date

		switch (`${mutate}.${unit}`) {
			case 'start.day':
				break;
			case 'end.day':
				[date.HH, date.MI, date.SS] = [23, 59, 59];
				break;
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

		return new Instant(new Date(date.yy, date.mm - 1, date.dd, date.HH, date.MI, date.SS));
	}

	/** combine Instant components to apply some standard format rules */
	private formatDate = <K extends keyof IDateFmt>(fmt: K): IDateFmt[K] => {
		const date = { ...this.date };													// clone current Instant
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
				return `${date.dn}, ${fix(date.dd)} ${date.mn} ${date.yy}`;

			case DATE_FMT.dayMonth:
				return `${fix(date.dd)}-${date.mn}`;

			case DATE_FMT.dateTime:
				return `${date.yy}-${date.mn}-${fix(date.dd)} ${fix(date.HH)}:${fix(date.MI)}`;

			default:
				return '';
		}
	}

	/** calculate the difference between dates */
	private diffDate = (dt2?: TDate, unit: TUnitDiff = 'years') =>
		Math.floor((this.parseDate(dt2).ts - this.date.ts) / divideBy[unit]);
}

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