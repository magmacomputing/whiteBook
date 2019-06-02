import { format } from 'util';

import { fix } from '@lib/number.library';
import { asString, toNumeric, asNumber } from '@lib/string.library';
import { isString, isNumber, getType, isUndefined } from '@lib/type.library';
import { worker } from 'cluster';

interface IInstant {											// Date components
	readonly yy: number;										// year[4]
	readonly mm: number;										// month; Jan=1, Dec=12
	readonly dd: number;										// day; 1-31
	readonly HH: number;										// hour[24]
	readonly MI: number;										// minute
	readonly SS: number;										// second
	readonly ts: number;										// timestamp
	readonly ms: number;										// milliseconds
	readonly ww: number;										// number of weeks
	readonly mmm: string;										// short month-name
	readonly ddd: string;										// short day-name
	readonly dow: number;										// weekday; Mon=1, Sun=7
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

type TMutate = 'add' | 'start' | 'mid' | 'end';
type TUnitTime = 'month' | 'months' | 'week' | 'weeks' | 'day' | 'days' | 'hour' | 'hours' | 'minute' | 'minutes';
type TUnitOffset = 'month' | 'week' | 'day';
type TUnitDiff = 'years' | 'months' | 'weeks' | 'days' | 'hours' | 'minutes' | 'seconds';
type TTimestamp = { seconds: number; nanoseconds: number; };

export type TDate = string | number | Date | Instant | IInstant | Timestamp | TTimestamp;

/**
 * Mirror the Firestore Timestamp
 */
export class Timestamp {
	readonly seconds: number;
	readonly nanoseconds: number;

	constructor(seconds?: number, nanoseconds?: number) {
		const now = new Date();
		this.seconds = isUndefined(seconds)
			? now.getSeconds()
			: seconds
		this.nanoseconds = isUndefined(nanoseconds)
			? now.getMilliseconds() * 1000000
			: nanoseconds
	}

	public toDate = () => new Date((this.seconds * 1000) + Math.floor(this.nanoseconds / 1000000));
	static fromDate = (dt: Date) => new Timestamp(dt.getSeconds(), dt.getMilliseconds() * 1000000);
	static fromStamp = (stamp: number) => Timestamp.fromDate(new Date(stamp * 1000));
	static now = new Timestamp();
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// shortcut functions to common Instant class properties / methods.
/** get new Instant */export const getDate = (dt?: TDate, ...args: string[] | number[]) => new Instant(dt, ...args);
/** get Timestamp */	export const getStamp = (dt?: TDate, ...args: string[] | number[]) => getDate(dt, ...args).ts;
/** format Instant */	export const fmtDate = <K extends keyof IDateFmt>(fmt: K, dt?: TDate, ...args: string[] | number[]) => getDate(dt, ...args).format(fmt);

/**
 * An Instant is a object that is used to manage Dates.  
 * It has properties to break a Date into components ('yy', 'dd', etc.)  
 * It has methods to perform Date manipulations (add(), format(), diff(), startOf(), etc.)  
 * It has short-cut functions to work with an Instant (getDate(), getStamp(), fmtDate())
 */
export class Instant {
	private date: IInstant;																				// Date parsed into components
	private self!: { -readonly [P in keyof Instant]: Instant[P] };// hidden reference to self

	constructor(dt?: TDate, ...args: string[] | number[]) { this.date = this.parseDate(dt, args); this.self = this; }

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

	// Private methods	~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
	/** parse a Date, return components */
	private parseDate = (dt?: TDate, args: string[] | number[] = []) => {
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
			case 'String':
				const fmt = dt as string;
				date = new Date(args.length
					? this.formatString(fmt, ...args)										// free-format string
					: fmt)																							// let Javascript interpret string
				break;
			case 'Number':																					// check whether milliseconds or microseconds
				const nbr = dt as number;
				const val = (nbr < Instant.maxStamp ? nbr * 1000 : nbr);// assume timestamp to milliseconds
				date = new Date(val);
				break;
			case 'Instant':																					// already have a valid Instant
				date = (dt as Instant).asDate();
				break;
			case 'Timestamp':																				// instance of Timestamp
				date = (dt as Timestamp).toDate();
				break;
			case 'Object':
				const ts = dt as TTimestamp;													// shape of Timestamp
				const obj = dt as IInstant;														// shape of Instant
				if (isNumber(ts.seconds) && isNumber(ts.nanoseconds)) {
					date = new Timestamp(ts.seconds, ts.nanoseconds).toDate();
					break;
				}
				if (isNumber(obj.yy) && isNumber(obj.mm) && isNumber(obj.dd)) {
					date = this.makeDate(obj);
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

		return new Instant(this.makeDate(date));
	}

	private makeDate = (date: IInstant) => {
		return new Date(new Date(date.yy, date.mm - 1, date.dd, date.HH, date.MI, date.SS, date.ms));
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

	private formatString = (fmt: string, ...args: string[] | number[]) => {
		const date = new Instant().startOf('day').toObject()					// date components
		let cnt = 0;

		fmt.split('%')
			.forEach(word => {
				const word4 = word.substring(0, 4),
					word3 = word.substring(0, 3),
					word2 = word.substring(0, 2);
				let param = args[cnt];

				switch (true) {
					case word2 === 'yy' && word4 !== 'yyyy':
						param = parseInt('20' + param) < (date.yy + 10)
							? '20' + param
							: '19' + param
					case word4 === 'yyyy':
						date.yy = asNumber(param);
						break;

					case word3 === 'mmm':
						param = Instant.MONTH[param as keyof typeof Instant.MONTH];
					case word2 === 'mm':
						date.mm = asNumber(param);
						break;

					case word3 === 'ddd':
						let nbr = Instant.DAY[param as keyof typeof Instant.DAY];
						param = (date.dd - date.dow + nbr).toString();
					case word2 === 'dd':
						date.dd = asNumber(param);
						break;

					case word2 === 'HH':
						date.HH = asNumber(param);
						break;
					case word2 === 'MM':
					case word2 === 'MI':
						date.MI = asNumber(param);
						break;
					case word2 === 'SS':
						date.SS = asNumber(param)
						break;
					default:
						cnt -= 1;
				}
				cnt += 1;
			})

		return new Instant(date).asDate();
	}

	/** calculate the difference between dates */
	private diffDate = (unit: TUnitDiff = 'years', dt2?: TDate, ...args: string[]) => {
		const offset = this.parseDate(dt2, args);
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
	export const ddmmyyyy = /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[012])\/(19\d{2}|20\d{2})$/;
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