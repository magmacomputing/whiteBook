import { fix } from '@library/number.library';
import { asString, asNumber, toTitle } from '@library/string.library';
import { getType, isString, isNumber } from '@library/type.library';

interface InstantVars {							// Instant values
	yy: number;												// year[4]
	mm: number;												// month; Jan=1, Dec=12
	dd: number;												// day; 1-31
	HH: number;												// hour[24]
	MI: number;												// minute
	SS: number;												// second
	ts: number;												// seconds since epoch
	ms: number;												// milliseconds
	ww: number;												// number of weeks
	mmm: keyof typeof Instant.MONTH;	// short month-name
	ddd: keyof typeof Instant.WEEKDAY;// short day-name
	dow: Instant.WEEKDAY;							// weekday; Mon=1, Sun=7
	tz: number;												// timezone offset in hours
	value?: TInstant;									// original value passed to constructor
}

interface DateFmt extends Record<string, string | number> {	// pre-configured format strings
	"ddd, dd mmm yyyy": string;
	"yyyy-mm-dd HH:MI": string;
	"dd-mmm": string;
	"HH:MI": string;
	"hh:mi": string;
	"HH:MI:SS": string;
	"yyyyww": number;
	"yyyymm": number;
	"yyyymmdd": number;
}

type TArgs = string[] | number[];
type TMutate = 'add' | 'start' | 'mid' | 'end';
type TUnitTime = 'year' | 'month' | 'week' | 'day' | 'hour' | 'minute' | 'second';
type TUnitDiff = 'years' | 'months' | 'weeks' | 'days' | 'hours' | 'minutes' | 'seconds';

export type TInstant = string | number | Date | Instant | Timestamp;

/** Mirror the Firestore Timestamp class */
class Timestamp {
	readonly seconds: number;
	readonly nanoseconds: number;
	#now: number;

	constructor(seconds?: number, nanoseconds?: number) {
		const now = new Date();
		this.seconds = seconds ?? now.getSeconds();
		this.nanoseconds = nanoseconds ?? now.getMilliseconds() * 1_000_000;
		this.#now = now.setHours(0, 0, this.seconds, this.nanoseconds / 1000);
	}

	public toDate = () => new Date(this.#now);
	static fromDate = (dt: Date) => new Timestamp(dt.getSeconds(), dt.getMilliseconds() * 1_000_000);
	static fromStamp = (stamp: number) => Timestamp.fromDate(new Date(stamp * 1000));
	static now = new Timestamp();
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// shortcut functions to common Instant class properties / methods.
/** get new Instant */export const getDate = (dt?: TInstant, ...args: TArgs) => new Instant(dt, ...args);
/** get timestamp */	export const getStamp = (dt?: TInstant, ...args: TArgs) => getDate(dt, ...args).ts;
/** format Instant */	export const fmtDate = <K extends keyof DateFmt>(fmt: K, dt?: TInstant, ...args: TArgs) => getDate(dt, ...args).format(fmt);

// NOTE: Instant does not currently handle leap-seconds

/**
 * An Instant is a object that is used to manage Javascript Dates.  
 * It has properties that break a Date into components ('yy', 'dd', etc.)  
 * It has methods to perform Date manipulations (add(), format(), diff(), startOf(), etc.)  
 * It has short-cut functions to work with an Instant (getDate(), getStamp(), fmtDate())
 */
export class Instant {
	#date: InstantVars;													// Date parsed into components
	static maxStamp = new Date('9999-12-31').valueOf() / 1000;	// static property
	static minStamp = new Date('1000-01-01').valueOf() / 1000;	// static property

	constructor(dt?: TInstant, ...args: TArgs) { this.#date = this.#parseDate(dt, args); }

	// Public getters	~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
	/** 4-digit year */		get yy() { return this.#date.yy }
	/** month number */		get mm() { return this.#date.mm }
	/** day number */			get dd() { return this.#date.dd }
	/** 24-hour format */	get HH() { return this.#date.HH }
	/** minutes */				get MI() { return this.#date.MI }
	/** seconds */				get SS() { return this.#date.SS }
	/** timestamp */			get ts() { return this.#date.ts }
	/** milliseconds */		get ms() { return this.#date.ms }
	/** timezone offset */get tz() { return this.#date.tz }
	/** number of weeks*/	get ww() { return this.#date.ww }
	/** short month name*/get mmm() { return this.#date.mmm }
	/** short day name */	get ddd() { return this.#date.ddd }
	/** weekday number */	get dow() { return this.#date.dow }

	// Public methods	~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

	/** apply formatting*/
	format = <K extends keyof DateFmt>(fmt: K) => this.#formatDate(fmt);
	/** calc diff Dates, default as &lt;years> */
	diff = (unit: TUnitDiff = 'years', dt2?: TInstant, ...args: TArgs) => this.#diffDate(unit, dt2, ...args);
	/** add date offset, default as &lt;minutes> */
	add = (offset: number, unit: TUnitTime | TUnitDiff = 'minutes') => this.#setDate('add', unit, offset);

	/** start offset, default as &lt;week> */
	startOf = (unit: TUnitTime = 'week') => this.#setDate('start', unit);
	/** middle offset, default as &lt;week> */
	midOf = (unit: TUnitTime = 'week') => this.#setDate('mid', unit);
	/** ending offset, default as &lt;week> */
	endOf = (unit: TUnitTime = 'week') => this.#setDate('end', unit);

	/** valid Instant */	isValid = () => !isNaN(this.#date.ts);
	/** get raw object */	toJSON = () => ({ ...this.#date });
	/** as Date object */	toDate = () => this.#composeDate(this.#date);

	// Private methods	~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
	/** parse a Date, return components */
	#parseDate = (dt?: TInstant, args: TArgs = []) => {
		const pat = {
			hhmi: /^([01]\d|2[0-3]):([0-5]\d)( am| pm)?$/,					// regex to match HH:MI
			yyyymmdd: /^(19\d{2}|20\d{2})(0[1-9]|1[012])(0[1-9]|[12][0-9]|3[01])$/,
			ddmmyy: /^([1-9]|0[1-9]|[12][0-9]|3[01])[\/\-]?([1-9]|0[1-9]|1[012])[\/\-]?(\d{2})$/,							// d-m-yy
			ddmmyyyy: /^([1-9]|0[1-9]|[12][0-9]|3[01])[\/\-]?([1-9]|0[1-9]|1[012])[\/\-]?(19\d{2}|20\d{2})$/,	// d-m-yyyy
			ddmmyyyyHHMI: /^([1-9]|0[1-9]|[12][0-9]|3[01])[\/\-]?([1-9]|0[1-9]|1[012])[\/\-]?(19\d{2}|20\d{2}) ([01]\d|2[0-3]):([0-5]\d)/,	// d-m-yyyy {HH:MI}
			isoDate: /^(19\d{2}|20\d{2})-(0[1-9]|1[012])-(0[1-9]|[12][0-9]|3[01])T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)Z$/,
		}
		let date: Date;

		// first, conform the date
		if (isString(dt) && (dt.toLowerCase().endsWith('am') || dt.toLowerCase().endsWith('pm')))
			dt = dt.substring(0, dt.length - 2).trimEnd() + ' ' + dt.substr(-2).toLowerCase();
		if (isString(dt) && pat.hhmi.test(dt))										// if only HH:MI supplied...
			dt = `${new Date().toDateString()} ${dt}`;							// 	prepend current date
		if ((isString(dt) || isNumber(dt)) && pat.yyyymmdd.test(asString(dt)))// if yyyymmdd supplied as string...
			dt = asString(dt).replace(pat.yyyymmdd, '$1-$2-$3 00:00:00');				// format to look like a date-string
		if ((isString(dt) || isNumber(dt)) && pat.ddmmyyyy.test(asString(dt)))
			dt = asString(dt).replace(pat.ddmmyyyy, '$2-$1-$3');		// convert to US format
		if (isString(dt) && pat.ddmmyy.test(dt))
			dt = dt.replace(pat.ddmmyy, '$2-$1-$3');								// convert to US format
		if (isString(dt) && pat.ddmmyyyyHHMI.test(dt))
			dt = dt.replace(pat.ddmmyyyyHHMI, '$2-$1-$3 $4');				// convert to US format

		switch (getType(dt)) {																		// convert 'dt' argument into a Date
			case 'Undefined':																				// default to 'now'
				date = new Date();
				break;

			case 'Date':																						// already is a valid Date	
				date = new Date(dt as Date);													// clone a new Date
				break;

			case 'String':
				let fmt = dt as string;																// cast as string

				if (Instant.WEEKDAY[toTitle(fmt) as keyof typeof Instant.WEEKDAY] || Instant.WEEKDAYS[toTitle(fmt) as keyof typeof Instant.WEEKDAYS]) {
					const now = new Date();															// 3-character or full-character Weekday
					now.setDate(now.getDate() - 7 - now.getDay() + Instant.WEEKDAY[toTitle(fmt).substring(0, 3) as keyof typeof Instant.WEEKDAY]);
					fmt = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`
				}

				date = args.length
					? this.#formatString(fmt, ...args)									// free-format string
					: new Date(fmt)																			// let browser interpret string

				if (date.getFullYear() === 2001) {										// Javascript default year, if none in parse-string
					if (!fmt.includes('2001'))													// did not specifically request default year
						date.setFullYear(new Date().getFullYear());				// so, override to current year
				}
				break;

			case 'Number':																					// could be timestamp, or (with args) date-components
				const nbr = dt as number;															// cast as number
				const vals = args as number[];												// assumed as [MM, DD, HH, MI, SS, ms]
				date = vals.length
					? new Date(nbr, vals[0] - 1, ...vals.slice(1))			// change month-number to zero-indexed
					: new Date(nbr < Instant.maxStamp ? nbr * 1000 : nbr)	// assume timestamp to milliseconds
				break;

			case 'Instant':																					// already have a valid Instant
				date = (dt as Instant).toDate();
				break;

			case 'Timestamp':																				// instance of Timestamp
				date = (dt as Timestamp).toDate();
				break;

			case 'Object':
				const tstamp = dt as Timestamp;												// shape of Timestamp
				const inst = dt as Instant;														// shape of Instant
				if (isNumber(tstamp.seconds) && isNumber(tstamp.nanoseconds)) {
					date = new Timestamp(tstamp.seconds, tstamp.nanoseconds).toDate();
					break;
				}
				if (isNumber(inst.yy) && isNumber(inst.mm) && isNumber(inst.dd)) {
					date = this.#composeDate(inst);
					break;
				}

			default:																								// unexpected input
				date = new Date();
		}

		if (isNaN(date.getTime()))																// Date not parse-able,
			console.error('Invalid Date: ', dt, date);							// TODO: log the Invalid Date

		let [yy, mm, dd, HH, MI, SS, ts, ms, tz, dow] = [
			date.getFullYear(), date.getMonth(), date.getDate(),
			date.getHours(), date.getMinutes(), date.getSeconds(),
			Math.floor(date.getTime() / 1000), date.getMilliseconds(),
			date.getTimezoneOffset(), date.getDay(),
		];

		mm += 1;																									// ISO month
		if (!dow && !isNaN(dow)) dow = Instant.WEEKDAY.Sun;				// ISO weekday

		const thu = date.setDate(dd - dow + Instant.WEEKDAY.Thu);	// set to nearest Thursday
		const ny = new Date(date.getFullYear(), 0, 1).valueOf();	// NewYears Day
		const ww = Math.floor((thu - ny) / this.#divideBy('weeks') + 1);	// ISO Week Number

		return {
			yy, mm, dd, HH, MI, SS, ts, ms, tz, ww, dow,
			ddd: Instant.WEEKDAY[dow], mmm: Instant.MONTH[mm], value: dt
		} as InstantVars;
	}

	/** hide some working-variables */
	#divideBy = (unit: TUnitDiff) => {													// approx date-offset divisors (unix-timestamp precision)
		return {
			years: 31_536_000_000,
			months: 2_628_000_000,
			weeks: 604_800_000,
			days: 86_400_000,
			hours: 3_600_000,
			minutes: 60_000,
			seconds: 1_000,
		}[unit]
	}

	/** create a new offset Instant */
	#setDate = (mutate: TMutate, unit: TUnitTime | TUnitDiff, offset: number = 1) => {
		const date = { ...this.#date };														// clone the current Instant
		const single = unit.endsWith('s')
			? unit.substring(0, unit.length - 1)										// remove plural units
			: unit
		if (mutate !== 'add')
			[date.HH, date.MI, date.SS, date.ms] = [0, 0, 0, 0];		// discard the time-portion of the date

		switch (`${mutate}.${single}`) {
			case 'start.year':
				[date.mm, date.dd] = [1, 1];
			case 'start.month':
				date.dd = 1;
				break;
			case 'start.week':
				date.dd = date.dd - date.dow + Instant.WEEKDAY.Mon;
				break;
			case 'start.day':
				[date.HH, date.MI, date.SS, date.ms] = [0, 0, 0, 0];
				break;
			case 'start.hour':
				[date.MI, date.SS, date.ms] = [0, 0, 0];
				break;
			case 'start.minute':
				[date.SS, date.ms] = [0, 0];
				break;
			case 'start.second':
				date.ms = 0;
				break;

			case 'mid.year':
				[date.mm, date.dd] = [7, 1];
				break;
			case 'mid.month':
				date.dd = 15;
				break;
			case 'mid.week':
				date.dd = date.dd - date.dow + Instant.WEEKDAY.Thu;
				break;
			case 'mid.day':
				[date.HH, date.MI, date.SS, date.ms] = [12, 0, 0, 0];
				break;
			case 'mid.hour':
				[date.MI, date.SS, date.ms] = [30, 0, 0];
				break;
			case 'mid.minute':
				[date.SS, date.ms] = [30, 0];
				break;
			case 'mid.second':
				date.ms = 500;
				break;

			case 'end.year':
				[date.mm, date.dd] = [12, 31];
				break;
			case 'end.month':
				date.mm += 1;
				date.dd = 0;
				break;
			case 'end.week':
				date.dd = date.dd - date.dow + Instant.WEEKDAY.Sun;
				break;
			case 'end.day':
				[date.HH, date.MI, date.SS, date.ms] = [23, 59, 59, 999];
				break;
			case 'end.hour':
				[date.MI, date.SS, date.ms] = [59, 59, 999];
				break;
			case 'end.minute':
				[date.SS, date.ms] = [59, 999];
				break;
			case 'end.second':
				date.ms = 999;
				break;

			case 'add.year':
				date.yy += offset;
				break;
			case 'add.month':
				date.mm += offset;
				break;
			case 'add.week':
				date.dd += offset * 7;
				break;
			case 'add.day':
				date.dd += offset;
				break;
			case 'add.hour':
				date.HH += offset;
				break;
			case 'add.minute':
				date.MI += offset;
				break;
			case 'add.second':
				date.SS += offset;
				break;
		}

		return new Instant(this.#composeDate(date));
	}

	/** compose a Date() from an Instant() */
	#composeDate = (date: InstantVars) =>
		new Date(date.yy, date.mm - 1, date.dd, date.HH, date.MI, date.SS, date.ms)

	/** combine Instant components to apply some standard & free-format rules */
	#formatDate = <K extends keyof DateFmt>(fmt: K): DateFmt[K] => {
		const date = { ...this.#date };													// clone current Instant

		switch (fmt) {
			case Instant.FORMAT.yearWeek:
				const offset = date.ww === 1 && date.mm === 12;			// if late-Dec, add 1 to yy
				return parseInt(`${date.yy + Number(offset)}${fix(date.ww)}`);

			case Instant.FORMAT.yearMonth:
				return parseInt(`${fix(date.yy)}${fix(date.mm)}`);

			case Instant.FORMAT.yearMonthDay:
				return parseInt(`${date.yy}${fix(date.mm)}${fix(date.dd)}`, 10);

			default:
				const am = date.HH >= 12 ? 'pm' : 'am';							// noon is considered 'pm'

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
					.replace(/h{2}/g, fix(date.HH >= 13 ? date.HH % 12 : date.HH))
					.replace(/mi/g, fix(date.MI) + am)
					.replace(/S{2}/g, fix(date.SS))
					.replace(/ts/g, asString(date.ts))
					.replace(/ms/g, asString(date.ms))
					.replace(/w{2}/g, asString(date.ww))
					.replace(/dow/g, asString(date.dow))
		}
	}

	/**
	 * a fmt string contains '%' markers plus Instant components.  
	 * args contains array of values that will replace the marker-components.  
	 * this will return a new Date based on the interpolated fmt string.  
	 * e.g. ('%dd-%mmm', 20, 'May') will return new Date() for 20-May in current year.
	 */
	#formatString = (fmt: string, ...args: TArgs) => {
		const date = new Instant().startOf('day').toJSON()	// date components
		let argCnt = 0;

		fmt.split('%')
			.forEach(word => {
				const word4 = word.substring(0, 4),
					word3 = word.substring(0, 3),
					word2 = word.substring(0, 2);
				let param = args[argCnt];
				const str = asString(param);
				const num = asNumber(param);

				switch (true) {
					case word2 === 'yy' && word4 !== 'yyyy':
						date.yy = (2000 + num) < (date.yy + 10)
							? 2000 + num								// if less than ten-years, assume this century
							: 1900 + num								// if more than ten-years, assume last century
						break;
					case word4 === 'yyyy':
						date.yy = num;
						break;

					case word3 === 'mmm':						// change the month-name into a month-number
						param = Instant.MONTH[param as Instant.MONTH];
					case word2 === 'mm':
						date.mm = num;
						break;

					case word3 === 'ddd':						// set the day to the last occurrence of %ddd
						let weekDay = Instant.WEEKDAY[param as Instant.WEEKDAY];
						param = (date.dd - date.dow + weekDay).toString();
					case word2 === 'dd':
						date.dd = num;
						break;

					case word2 === 'hh' && str.endsWith('pm'):	// special case to coerce am/pm to pm
					case word2 === 'hh' && str.endsWith('am'):
						const hour = asNumber(str.substring(0, str.length - 2).trim());
						date.HH = hour % 12 + (str.endsWith('pm') || hour > 12 ? 1 : 0);
						break;
					case word2 === 'hh':
					case word2 === 'HH':
						date.HH = num;
						break;
					case word2 === 'MM':
					case word2 === 'MI':
					case word2 === 'mi':
						date.MI = num;
						break;
					case word2 === 'SS':
					case word2 === 'ss':
						date.SS = num;
						break;

					default:
						argCnt -= 1;
				}
				argCnt += 1;
			})

		return this.#composeDate(date);
	}

	/** calculate the difference between dates (past is positive, future is negative) */
	#diffDate = (unit: TUnitDiff = 'years', dt2?: TInstant, ...args: TArgs) => {
		const offset = this.#parseDate(dt2, args);
		const diff = (this.#date.ts * 1000 + this.#date.ms) - (offset.ts * 1000 + offset.ms);
		return diff < 0
			? Math.ceil(diff / this.#divideBy(unit))
			: Math.floor(diff / this.#divideBy(unit))
	}
}

export namespace Instant {
	export enum WEEKDAY { All, Mon, Tue, Wed, Thu, Fri, Sat, Sun };
	export enum WEEKDAYS { Every, Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday };
	export enum MONTH { All, Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec };
	export enum MONTHS { Every, January, February, March, April, May, June, July, August, September, October, November, December };
	export enum DURATION { 'year', 'month', 'week', 'day', 'hour', 'minute', 'second' };

	export enum FORMAT {
		display = 'ddd, dd mmm yyyy',
		dayTime = 'ddd, yyyy-mmm-dd HH:MI',
		sortTime = 'yyyy-mm-dd HH:MI', 						// useful for sorting display-strings
		dayMonth = 'dd-mmm',
		HHMI = 'HH:MI',														// 24-hour format
		hhmi = 'hh:mi', 													// 12-hour format
		time = 'HH:MI:SS',												// time-format
		yearWeek = 'yyyyww',
		yearMonth = 'yyyymm',
		yearMonthDay = 'yyyymmdd',
	}
}
