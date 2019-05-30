import { fix } from '@lib/number.library';
import { asString } from '@lib/string.library';
import { isString, isNumber, getType, TString, isObject, isUndefined } from '@lib/type.library';

interface IInstant {											// Date components
	yy: number;															// year[4]
	mm: number;															// month; Jan=1, Dec=12
	dd: number;															// day; 1-31
	HH: number;															// hour[24]
	MI: number;															// minute
	SS: number;															// second
	ts: number;															// timestamp
	ms: number;															// milliseconds
	ww: number;															// number of weeks
	mmm: string;														// short month-name
	ddd: string;														// short day-name
	dow: number;														// weekday; Mon=1, Sun=7
}

interface IDateFmt {											// pre-configured format strings
	[str: string]: string | number;					// allow for dynamic format-codes
	"ddd, dd mmm yyyy": string;
	"yyyy-mm-dd HH:MI": string;
	"dd-mmm": string;
	"HH:MI": string;
	"yyyyww": number;
	"yyyymm": number;
	"yyyymmdd": number;
}

export enum DATE_FMT {										// pre-configured format names
	display = 'ddd, dd mmm yyyy',
	dateTime = 'yyyy-mm-dd HH:MI',
	dayMonth = 'dd-mmm',
	HHMI = 'HH:MI',
	yearWeek = 'yyyyww',
	yearMonth = 'yyyymm',
	yearMonthDay = 'yyyymmdd',
}

export type TDate = string | number | Date | Instant | Timestamp | TTimestamp;
export type TTimestamp = { seconds: number; nanoseconds: number; };
export class Timestamp {								// this mirrors what Firestore already does
	seconds: number;
	nanoseconds: number;

	constructor(seconds?: number, nanoseconds?: number) {
		const now = new Date();
		this.seconds = isUndefined(seconds)
			? now.getSeconds() / 1000
			: seconds
		this.nanoseconds = isUndefined(nanoseconds)
			? now.getMilliseconds() * 1000000
			: nanoseconds
	}
	public toDate = () => new Date(this.seconds * Math.floor(this.nanoseconds / 1000000));
	static fromDate = (dt: Date) => new Timestamp(dt.getSeconds(), dt.getMilliseconds() * 1000000);
	static fromStamp = (stamp: number) => Timestamp.fromDate(new Date(stamp * 1000));
	static now = new Timestamp();
}

type TMutate = 'add' | 'start' | 'mid' | 'end';
type TUnitTime = 'month' | 'months' | 'week' | 'weeks' | 'day' | 'days' | 'hour' | 'hours' | 'minute' | 'minutes';
type TUnitOffset = 'month' | 'week' | 'day';
type TUnitDiff = 'years' | 'months' | 'weeks' | 'days' | 'hours' | 'minutes' | 'seconds';

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// shortcut functions to common Instant class properties / methods.
/** get new Instant */export const getDate = (dt?: TDate) => new Instant(dt);
/** get Timestamp */	export const getStamp = (dt?: TDate) => getDate(dt).ts;
/** format Instant */	export const fmtDate = <K extends keyof IDateFmt>(fmt: K, dt?: TDate) => getDate(dt).format(fmt);

/**
 * An Instant is a object that is used to manage Dates.  
 * It has properties to break a Date into components ('yy', 'dd', etc.)  
 * It has methods to perform Date manipulations (add(), format(), diff(), startOf(), etc.)  
 * It has short-cut functions to work with an Instant (getDate(), getStamp(), fmtDate())
 */
export class Instant {
	private date: IInstant;																			// Date parsed into components

	constructor(dt?: TDate, fmt?: TString) { this.date = this.parseDate(dt, fmt); }

	// Public getters	~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
	/** 4-digit year */		get yy() { return this.date.yy }
	/** month number */		get mm() { return this.date.mm }
	/** day number */			get dd() { return this.date.dd }
	/** 24-hour format */	get HH() { return this.date.HH }
	/** minutes */				get MI() { return this.date.MI }
	/** seconds */				get SS() { return this.date.SS }
	/** timestamp */			get ts() { return this.date.ts }
	/** milliseconds */		get ms() { return this.date.ms }
	/** number of weeks*/	get ww() { return this.date.ww }
	/** weekday number */	get dow() { return this.date.dow }
	/** short day name */	get ddd() { return this.date.ddd }
	/** short month name*/get mmm() { return this.date.mmm }

	// Public methods	~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
	/** apply formatting*/format = <K extends keyof IDateFmt>(fmt: K) => this.formatDate(fmt);
	/** calc diff Dates */diff = (unit: TUnitDiff = 'years', dt2?: TDate) => this.diffDate(unit, dt2);
	/** add date offset */add = (offset: number, unit: TUnitTime = 'minutes') => this.setDate('add', unit, offset);

	/** start offset */		startOf = (unit: TUnitOffset = 'week') => this.setDate('start', unit);
	/** middle offset */	midOf = (unit: TUnitOffset = 'week') => this.setDate('mid', unit);
	/** ending offset */	endOf = (unit: TUnitOffset = 'week') => this.setDate('end', unit);

	/** valid Instant */	isValid = () => !isNaN(this.date.ts);
	/** get raw object */	toObject = () => ({ ...this.date });
	/** as Date object */	asDate = () => new Date(this.date.ts * 1000 + this.date.ms);

	// Private methods	~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
	/** parse a Date, return components */
	private parseDate = (dt?: TDate, fmt?: TString) => {				// TODO: allow for <fmt> when parsing a :string argument
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
			case 'Instant':																					// already have a valid Instant
				date = (dt as Instant).asDate();
				break;
			case 'String':																					// TODO: use fmt to parse date-string
				date = new Date(dt as string);												// attempt to parse date-string
				break;
			case 'Number':																					// check whether milliseconds or microseconds
				const nbr = dt as number;
				const val = (nbr < Instant.maxStamp ? nbr * 1000 : nbr);// assume timestamp to milliseconds
				date = new Date(val);
				break;
			case 'Timestamp':																				// instance of Timestamp
				date = (dt as Timestamp).toDate();
				break;
			case 'Object':																					// shape of Timestamp
				const ts = dt as TTimestamp;
				if (isNumber(ts.seconds) && isNumber(ts.nanoseconds)) {
					date = new Timestamp(ts.seconds, ts.nanoseconds).toDate();
					break;
				}
			default:																								// unexpected input
				date = new Date();
		}

		if (isNaN(date.getTime()))																// Date not parse-able,
			console.error('Invalid Date: ', dt, date);							// log the Invalid Date

		let [yy, mm, dd, HH, MI, SS, ts, ms, dow] = [
			date.getFullYear(), date.getMonth(), date.getDate(),
			date.getHours(), date.getMinutes(), date.getSeconds(),
			Math.floor(date.getTime() / 1000), date.getMilliseconds(), date.getDay(),
		];

		mm += 1;																									// ISO month
		if (!dow && !isNaN(dow)) dow = Instant.DAY.Sun;						// ISO weekday

		const thu = date.setDate(dd - dow + Instant.DAY.Thu);			// set to nearest Thursday
		const ny = new Date(date.getFullYear(), 0, 1).valueOf();	// NewYears Day
		const ww = Math.floor((thu - ny) / Instant.divideBy.weeks + 1);	// ISO Week Number

		return { yy, mm, dd, HH, MI, SS, ts, ms, ww, dow, ddd: Instant.DAY[dow], mmm: Instant.MONTH[mm] } as IInstant;
	}

	/** mutate an Instant */
	private setDate = (mutate: TMutate, unit: TUnitTime, offset: number = 1) => {
		const date = { ...this.date };														// clone the current Instant
		const single = unit.endsWith('s')
			? unit.substring(0, unit.length - 1)										// remove plural units
			: unit
		if (mutate !== 'add')
			[date.HH, date.MI, date.SS, date.ms] = [0, 0, 0, 0];		// discard the time-portion of the date

		switch (`${mutate}.${single}`) {
			case 'start.minute':
				[date.SS, date.ms] = [0, 0];
				break;
			case 'start.hour':
				[date.MI, date.SS, date.ms] = [0, 0, 0];
				break;
			case 'start.day':
				[date.HH, date.MI, date.SS, date.ms] = [0, 0, 0, 0];
				break;
			case 'start.week':
				date.dd -= date.dow + Instant.DAY.Mon;
				break;
			case 'start.month':
				date.dd = 1;
				break;
			case 'mid.second':
				[date.SS, date.ms] = [30, 0];
				break;
			case 'mid.minute':
				[date.MI, date.SS, date.ms] = [30, 0, 0];
				break;
			case 'mid.day':
				[date.HH, date.MI, date.SS, date.ms] = [12, 0, 0, 0];
				break;
			case 'mid.week':
				date.dd -= date.dow + Instant.DAY.Thu;
				break;
			case 'mid.month':
				date.dd = 15;
				break;
			case 'end.second':
				[date.SS, date.ms] = [59, 999];
				break;
			case 'end.minute':
				[date.MI, date.SS, date.ms] = [59, 59, 999];
				break;
			case 'end.day':
				[date.HH, date.MI, date.SS, date.ms] = [23, 59, 59, 999];
				break;
			case 'end.week':
				date.dd -= date.dow + Instant.DAY.Sun;
				break;
			case 'end.month':
				date.mm += 1;
				date.dd = 0;
				break;
			case 'add.minute':
				date.MI += offset;
				break;
			case 'add.hour':
				date.HH += offset;
				break;
			case 'add.day':
				date.dd += offset;
				break;
			case 'add.month':
				date.mm += offset;
				break;
		}

		return new Instant(new Date(date.yy, date.mm - 1, date.dd, date.HH, date.MI, date.SS, date.ms));
	}

	/** combine Instant components to apply some standard / free-format rules */
	private formatDate = <K extends keyof IDateFmt>(fmt: K): IDateFmt[K] => {
		const date = { ...this.date };													// clone current Instant

		switch (fmt) {
			case DATE_FMT.yearWeek:
				const offset = date.ww === 1 && date.mm === 12;			// if late-Dec, add 1 to yy
				return parseInt(`${date.yy + Number(offset)}${fix(date.ww)}`);

			case DATE_FMT.yearMonth:
				return parseInt(`${fix(date.yy)}${fix(date.mm)}`);

			case DATE_FMT.yearMonthDay:
				return parseInt(`${date.yy}${fix(date.mm)}${fix(date.dd)}`, 10);

			default:
				return asString(fmt)
					.replace(/y{4}/g, fix(date.yy))
					.replace(/y{2}/g, fix(date.yy).substring(2, 4))
					.replace(/m{3}/g, date.mmm)
					.replace(/m{2}/g, fix(date.mm))
					.replace(/d{3}/g, date.ddd)
					.replace(/d{2}/g, fix(date.dd))
					.replace(/H{2}/g, fix(date.HH))
					.replace(/M{2}/g, fix(date.MI))
					.replace(/MI/g, fix(date.MI))
					.replace(/S{2}/g, fix(date.SS))
					.replace(/ts/g, asString(date.ts))
					.replace(/ms/g, asString(date.ms))
					.replace(/w{2}/g, asString(date.ww))
					.replace(/dow/g, asString(date.dow))
		}
	}

	/** calculate the difference between dates */
	private diffDate = (unit: TUnitDiff = 'years', dt2?: TDate) => {
		const offset = this.parseDate(dt2);
		return Math.floor(((offset.ts * 1000 + offset.ms) - (this.date.ts * 1000 + this.date.ms)) / Instant.divideBy[unit]);
	}
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
		years: 31536000000,
		months: 2628000000,
		weeks: 604800000,
		days: 86400000,
		hours: 3600000,
		minutes: 60000,
		seconds: 1000,
	}
}