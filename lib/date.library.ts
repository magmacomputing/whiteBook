import { fix } from '@lib/number.library';
import { isString, isNumber, getType } from '@lib/type.library';

interface IInstant {											// Date components
	yy: number;															// year[4]
	mm: number;															// month; Jan=1, Dec=12
	mn: string;															// short month-name
	dd: number;															// day; 1-31
	dn: string;															// short day-name
	wd: number;															// weekday; Mon=1, Sun=7
	ww: number;															// number of weeks
	HH: number;															// hour[24]
	MI: number;															// minute
	SS: number;															// second
	ts: number;															// unix timestamp
}

interface IDateFmt {
	yearMonthDay: number;
	HHmi: string;
	display: string;
	dayMonth: string;
	dateTime: string;
	Date: Date;
}

export enum DATE_FMT {
	yearMonthDay = 'yearMonthDay',
	HHmi = 'HHmi',
	display = 'display',
	dayMonth = 'dayMonth',
	dateTime = 'dateTime',
	Date = 'Date',
}

export enum DAY { Mon = 1, Tue, Wed, Thu, Fri, Sat, Sun }
export enum WEEKDAY { Monday = 1, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday }
export enum MONTH { Jan = 1, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec }
export enum MONTHS { January = 1, February, March, April, May, June, July, August, September, October, November, December }
export type TDate = string | number | Date | Instant;
type TMutate = 'add' | 'start' | 'mid' | 'end';
type TUnitTime = 'month' | 'months' | 'day' | 'days' | 'minute' | 'minutes' | 'hour' | 'hours';
type TUnitOffset = 'day' | 'week' | 'month';
type TUnitDiff = 'years' | 'months' | 'weeks' | 'days' | 'hours' | 'minutes' | 'seconds';

const hhmi = /^\d\d:\d\d$/;									// regex to match HH:MI
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
const maxStamp = new Date('9999-12-31').valueOf() / 1000;
const minStamp = new Date('1000-01-01').valueOf() / 1000;
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

/** shortcut functions to common Instant class properties / methods */
const isInstant = (dt?: TDate): dt is Instant => getType(dt) === 'Instant';
/** get new Instant */export const getDate = (dt?: TDate) => isInstant(dt) ? dt : new Instant(dt);
/** get ms Timestamp*/export const getStamp = (dt?: TDate) => getDate(dt).ts;
/** format Instant  */export const fmtDate = <K extends keyof IDateFmt>(fmt: K, dt?: TDate) => getDate(dt).format(fmt);

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
/** minute copy */		get MI() { return this.date.MI }
/** seconds */				get SS() { return this.date.SS }
/** weekday number */	get wd() { return this.date.wd }
/** number of weeks*/	get ww() { return this.date.ww }
/** unix timestamp */	get ts() { return this.date.ts }

/** apply formatting*/format = <K extends keyof IDateFmt>(fmt: K) => this.formatDate(fmt);
/** calc diff Dates */diff = (unit: TUnitDiff = 'years', dt2?: TDate) => this.diffDate(dt2, unit);
/** add date offset */add = (offset: number, unit: TUnitTime = 'minutes') => this.setDate('add', unit, offset);
/** start offset */		startOf = (unit: TUnitOffset = 'week') => this.setDate('start', unit);
/** middle offset */	midOf = (unit: TUnitOffset = 'week') => this.setDate('mid', unit);
/** ending offset */	endOf = (unit: TUnitOffset = 'week') => this.setDate('end', unit);
/** is Instant valid*/isValid = () => !isNaN(this.date.ts);

	/** break a Date into components */
	private parseDate = (dt?: TDate) => {
		if (isString(dt) && hhmi.test(dt))												// if only HH:MI supplied...
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
				const val = (nbr < maxStamp ? nbr * 1000 : nbr);			// assume timestamp to milliseconds
				date = new Date(val);
				break;
			default:																								// unexpected input
				date = new Date();
		}
		if (isNaN(date.getTime()))
			console.log('Invalid Date: ', dt, date);								// log the Invalid Date

		let [yy, mm, dd, wd, HH, MI, SS, ts] = [
			date.getFullYear(), date.getMonth(), date.getDate(), date.getDay(),
			date.getHours(), date.getMinutes(), date.getSeconds(), Math.round(date.getTime() / 1000),
		];

		mm += 1;																									// ISO month
		if (!wd && !isNaN(wd)) wd = DAY.Sun;											// ISO weekday

		const thu = date.setDate(dd - wd + DAY.Thu) / 1000;				// set to nearest Thursday
		const ny = new Date(date.getFullYear(), 0, 1).valueOf() / 1000;	// NewYears Day
		const ww = Math.floor((thu - ny) / divideBy.weeks + 1);		// calc Week Number

		return { yy, mm, dd, wd, ww, HH, MI, SS, ts, mn: MONTH[mm], dn: DAY[wd] } as IInstant;
	}

	/** mutate an Instant */
	private setDate = (mutate: TMutate, unit: TUnitTime | TUnitOffset, offset: number = 1) => {
		const date = { ...this.date };														// clone the current Instant
		if (mutate !== 'add')
			[date.HH, date.MI, date.SS] = [0, 0, 0];								// discard the time-portion of the date

		switch (`${mutate}.${unit}`) {
			case 'start.day':
				break;
			case 'start.week':
				date.dd -= date.wd + DAY.Mon;
				break;
			case 'start.month':
				date.dd = 1;
				break;
			case 'mid.day':
				[date.HH, date.MI, date.SS] = [12, 0, 0];
				break;
			case 'mid.week':
				date.dd -= date.wd + DAY.Thu;
				break;
			case 'mid.month':
				date.dd = 15;
				break;
			case 'end.day':
				[date.HH, date.MI, date.SS] = [23, 59, 59];
				break;
			case 'end.week':
				date.dd -= date.wd + DAY.Sun;
				break;
			case 'end.month':
				date.mm += 1;
				date.dd = 0;
				break;
			case 'add.month':
			case 'add.months':
				date.mm += offset;
				break;
			case 'add.day':
			case 'add.days':
				date.dd += offset;
				break;
			case 'add.hour':
			case 'add.hours':
				date.HH += offset;
				break;
			case 'add.minute':
			case 'add.minutes':
				date.MI += offset;
				break;
		}

		return new Instant(new Date(date.yy, date.mm - 1, date.dd, date.HH, date.MI, date.SS));
	}

	/** combine Instant components to apply some standard format rules */
	private formatDate = <K extends keyof IDateFmt>(fmt: K): IDateFmt[K] => {
		const date = { ...this.date };													// clone current Instant
		switch (fmt) {
			case DATE_FMT.HHmi:
				return `${fix(date.HH)}:${fix(date.MI)}`;

			case DATE_FMT.yearMonthDay:
				return parseInt(`${date.yy}${fix(date.mm)}${fix(date.dd)}`, 10);

			case DATE_FMT.display:
				return `${date.dn}, ${fix(date.dd)} ${date.mn} ${date.yy}`;

			case DATE_FMT.dayMonth:
				return `${fix(date.dd)}-${date.mn}`;

			case DATE_FMT.dateTime:
				return `${date.yy}-${date.mn}-${fix(date.dd)} ${fix(date.HH)}:${fix(date.MI)}`;

			case DATE_FMT.Date:
				return new Date(`${date.yy}-${date.mm}-${date.dd} ${date.HH}:${date.MI}:${date.SS}`);

			default:
				return '';
		}
	}

	/** calculate the difference between dates */
	private diffDate = (dt2?: TDate, unit: TUnitDiff = 'years') =>
		Math.floor((this.parseDate(dt2).ts - this.date.ts) / divideBy[unit]);
}