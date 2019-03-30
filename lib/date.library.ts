import { fix } from '@lib/number.library';
import { asString } from '@lib/string.library';
import { isString, isNumber, getType } from '@lib/type.library';

interface IInstant {											// Date components
	yyyy: number;														// year[4]
	mmm: string;														// short month-name
	ddd: string;														// short day-name
	dow: number;														// weekday; Mon=1, Sun=7
	mm: number;															// month; Jan=1, Dec=12
	dd: number;															// day; 1-31
	ww: number;															// number of weeks
	HH: number;															// hour[24]
	MI: number;															// minute
	SS: number;															// second
	ts: number;															// unix timestamp
}

interface IDateFmt {
	yyyymmdd: number;
	HHMI: string;
	"ddd, dd mmm yyyy": string;
	"dd-mmm": string;
	"yyyy-mm-dd HH:MI": string;
	yyyyww: number;
	Date: Date;
	Object: IInstant;
}

export enum DATE_FMT {
	yearMonthDay = 'yyyymmdd',
	HHmi = 'HHMI',
	display = 'ddd, dd mmm yyyy',
	dayMonth = 'dd-mmm',
	dateTime = 'yyyy-mm-dd HH:MI',
	week = 'yyyyww',
	Date = 'Date',
	Object = 'Object',
}

export type TDate = string | number | Date | Instant;

type TMutate = 'add' | 'start' | 'mid' | 'end';
type TUnitTime = 'month' | 'months' | 'day' | 'days' | 'minute' | 'minutes' | 'hour' | 'hours';
type TUnitOffset = 'day' | 'week' | 'month';
type TUnitDiff = 'years' | 'months' | 'weeks' | 'days' | 'hours' | 'minutes' | 'seconds';

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// shortcut functions to common Instant class properties / methods.

/** get new Instant */export const getDate = (dt?: TDate) => new Instant(dt);
/** get ms Timestamp*/export const getStamp = (dt?: TDate) => getDate(dt).ts;
/** format Instant  */export const fmtDate = <K extends keyof IDateFmt>(fmt: K, dt?: TDate) => getDate(dt).format(fmt);

export class Instant {
	private date: IInstant;											// Date parsed into components

	constructor(dt?: TDate) { this.date = this.parseDate(dt); }

	// Public getters	~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
	/** 4-digit year */		get yyyy() { return this.date.yyyy }
	/** month number */		get mm() { return this.date.mm }
	/** day number */			get dd() { return this.date.dd }
	/** 24-hour format */	get HH() { return this.date.HH }
	/** minute */					get MM() { return this.date.MI }
	/** minute copy */		get MI() { return this.date.MI }
	/** seconds */				get SS() { return this.date.SS }
	/** number of weeks*/	get ww() { return this.date.ww }
	/** unix timestamp */	get ts() { return this.date.ts }
	/** weekday number */	get dow() { return this.date.dow }
	/** short day name */	get ddd() { return this.date.ddd }
	/** short month name*/get mmm() { return this.date.mmm }

	// Public methods	~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
	/** apply formatting*/format = <K extends keyof IDateFmt>(fmt: K) => this.formatDate(fmt);
	/** calc diff Dates */diff = (unit: TUnitDiff = 'years', dt2?: TDate) => this.diffDate(dt2, unit);
	/** add date offset */add = (offset: number, unit: TUnitTime = 'minutes') => this.setDate('add', unit, offset);
	/** start offset */		startOf = (unit: TUnitOffset = 'week') => this.setDate('start', unit);
	/** middle offset */	midOf = (unit: TUnitOffset = 'week') => this.setDate('mid', unit);
	/** ending offset */	endOf = (unit: TUnitOffset = 'week') => this.setDate('end', unit);
	/** is Instant valid*/isValid = () => !isNaN(this.date.ts);

	// Private methods	~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
	/** parse a Date, return components */
	private parseDate = (dt?: TDate) => {
		let date: Date;

		if (isString(dt) && Instant.hhmi.test(dt))								// if only HH:MI supplied...
			dt = `${new Date().toDateString()} ${dt}`;							// 	prepend current date
		if ((isString(dt) || isNumber(dt)) && Instant.yyyymmdd.test(asString(dt)))// if yyyymmdd supplied as string...
			dt = asString(dt).replace(Instant.yyyymmdd, '$1-$2-$3 00:00:00');				// format to look like a date-string

		switch (getType(dt)) {																		// translate supplied parameter into a Date
			case 'Undefined':																				// set to 'now'
				date = new Date();
				break;
			case 'Date':																						// already is a valid Date
				date = dt as Date;
				break;
			case 'Instant':																					// already have a valid Date
				date = (dt as Instant).format(DATE_FMT.Date);
				break;
			case 'String':
				date = new Date(dt as string);												// attempt to parse date-string
				break;
			case 'Number':																					// check whether milliseconds or microseconds
				const nbr = dt as number;
				const val = (nbr < Instant.maxStamp ? nbr * 1000 : nbr);// assume timestamp to milliseconds
				date = new Date(val);
				break;
			default:																								// unexpected input
				date = new Date();
		}

		if (isNaN(date.getTime()))																// Date not parse-able,
			console.log('Invalid Date: ', dt, date);								// log the Invalid Date

		let [yyyy, mm, dd, dow, HH, MI, SS, ts] = [
			date.getFullYear(), date.getMonth(), date.getDate(), date.getDay(),
			date.getHours(), date.getMinutes(), date.getSeconds(), Math.round(date.getTime() / 1000),
		];

		mm += 1;																									// ISO month
		if (!dow && !isNaN(dow)) dow = Instant.DAY.Sun;										// ISO weekday

		const thu = date.setDate(dd - dow + Instant.DAY.Thu) / 1000;			// set to nearest Thursday
		const ny = new Date(date.getFullYear(), 0, 1).valueOf() / 1000;	// NewYears Day
		const ww = Math.floor((thu - ny) / Instant.divideBy.weeks + 1);	// ISO Week Number

		return { yyyy, mm, dd, dow, ww, HH, MI, SS, ts, mmm: Instant.MONTH[mm], ddd: Instant.DAY[dow] } as IInstant;
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
				date.dd -= date.dow + Instant.DAY.Mon;
				break;
			case 'start.month':
				date.dd = 1;
				break;
			case 'mid.day':
				[date.HH, date.MI, date.SS] = [12, 0, 0];
				break;
			case 'mid.week':
				date.dd -= date.dow + Instant.DAY.Thu;
				break;
			case 'mid.month':
				date.dd = 15;
				break;
			case 'end.day':
				[date.HH, date.MI, date.SS] = [23, 59, 59];
				break;
			case 'end.week':
				date.dd -= date.dow + Instant.DAY.Sun;
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

		return new Instant(new Date(date.yyyy, date.mm - 1, date.dd, date.HH, date.MI, date.SS));
	}

	/** combine Instant components to apply some standard / free-format rules */
	private formatDate = <K extends keyof IDateFmt>(fmt: K, code?: string): IDateFmt[K] => {
		const date = { ...this.date };													// clone current Instant
		switch (fmt) {
			case DATE_FMT.HHmi:
				return `${fix(date.HH)}:${fix(date.MI)}`;

			case DATE_FMT.yearMonthDay:
				return parseInt(`${date.yyyy}${fix(date.mm)}${fix(date.dd)}`, 10);

			case DATE_FMT.display:
				return `${date.ddd}, ${fix(date.dd)} ${date.mmm} ${date.yyyy}`;

			case DATE_FMT.dayMonth:
				return `${fix(date.dd)}-${date.mmm}`;

			case DATE_FMT.dateTime:
				return `${date.yyyy}-${date.mmm}-${fix(date.dd)} ${fix(date.HH)}:${fix(date.MI)}`;

			case DATE_FMT.week:
				const offset = date.ww === 1 && date.mm === 12;	// if Dec, add 1 to yyyy
				return parseInt(`${date.yyyy + Number(offset)}${fix(date.ww)}`);

			case DATE_FMT.Date:
				return new Date(`${date.yyyy}-${date.mmm}-${date.dd} ${date.HH}:${date.MI}:${date.SS}`);

			case DATE_FMT.Object:
				return date;

			default:
				return fmt
					.replace(/y{4}/g, fix(date.yyyy))
					.replace(/y{2}/g, fix(date.yyyy).substring(2, 4))
					.replace(/m{3}/g, date.mmm)
					.replace(/m{2}/g, fix(date.mm))
					.replace(/d{3}/g, date.ddd)
					.replace(/d{2}/g, fix(date.dd))
					.replace(/H{2}/g, fix(date.HH))
					.replace(/M{2}/g, fix(date.MI))
					.replace(/MI/g, fix(date.MI))
					.replace(/S{2}/g, fix(date.SS))
					.replace(/w{2}/g, asString(date.ww))
					.replace(/dow/g, asString(date.dow)) as string;
		}
	}

	/** calculate the difference between dates */
	private diffDate = (dt2?: TDate, unit: TUnitDiff = 'years') =>
		Math.floor((this.parseDate(dt2).ts - this.date.ts) / Instant.divideBy[unit]);
}

export namespace Instant {
	export enum DAY { Mon = 1, Tue, Wed, Thu, Fri, Sat, Sun }
	export enum WEEKDAY { Monday = 1, Tuesday, Wedddesday, Thursday, Friday, Saturday, Sunday }
	export enum MONTH { Jan = 1, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec }
	export enum MONTHS { January = 1, February, March, April, May, June, July, August, September, October, November, December }

	export const hhmi = /^\d\d:\d\d$/;								// regex to match HH:MI
	export const yyyymmdd = /^(19\d{2}|20\d{2})(0[1-9]|1[012])(0[1-9]|[12][0-9]|3[01])$/;	// regex to match YYYYMMDD
	export const maxStamp = new Date('9999-12-31').valueOf() / 1000;
	export const minStamp = new Date('1000-01-01').valueOf() / 1000;
	export const divideBy = {													// approx date-offset divisors (unix-timestamp precision)
		years: 31536000,
		months: 2628000,
		weeks: 604800,
		days: 86400,
		hours: 3600,
		minutes: 60,
		seconds: 1,
	}
}