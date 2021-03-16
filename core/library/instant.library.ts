import { asString, asNumber, toProperCase } from '@library/string.library';
import { getType, isString, isNumber, TPlural } from '@library/type.library';
import { fix } from '@library/number.library';

interface InstantVars {							// Instant values
	yy: number;												// year[4]
	mm: number;												// month; Jan=1, Dec=12
	dd: number;												// day; 1-31
	hh: number;												// hour[24]
	mi: number;												// minutes
	ss: number;												// seconds
	ts: number;												// seconds since Unix epoch
	ms: number;												// milliseconds since last second
	ww: number;												// number of weeks
	tz: number;												// timezone offset in hours
	age: number;											// milliseconds since Unix epoch
	dow: Instant.WEEKDAY;							// weekday; Mon=1, Sun=7
	value?: Instant.TYPE;							// original value passed to constructor
}

interface DateFmt {									// pre-configured format strings
	[str: string]: string | number;		// allow for dynamic format-codes
	"ddd, dd mmm yyyy": string;
	"yyyy-mm-dd HH:mi": string;
	"dd-mmm": string;
	"HH:mi": string;
	"HH:mi:ss": string;
	"hh:mi": string;
	"yyyyww": number;
	"yyyymm": number;
	"yyyymmdd": number;
	"ddd, yyyy-mmm-dd HH:mi": string;
}

type TArgs = string[] | number[];
type TMutate = 'add' | 'start' | 'mid' | 'end';
type TUnitTime = 'year' | 'month' | 'week' | 'day' | 'hour' | 'minute' | 'second' | 'millisecond';
type TUnitDiff = TPlural<TUnitTime>;

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// shortcut functions to common Instant class properties / methods.
/** get new Instant */export const getInstant = (dt?: Instant.TYPE, ...args: TArgs) => new Instant(dt, ...args);
/** format Instant */	export const fmtInstant = <K extends keyof DateFmt>(fmt: K, dt?: Instant.TYPE, ...args: TArgs) => new Instant(dt, ...args).format(fmt);
/** get timestamp */	export const getStamp = (dt?: Instant.TYPE, ...args: TArgs) => new Instant(dt, ...args).ts;

// NOTE: Instant does not currently handle leap-seconds

/**
 * An Instant is a object that is used to manage Javascript Dates.  
 * It has properties that break a Date into components ('yy', 'dd', etc.)  
 * It has methods to perform Date manipulations (add(), format(), diff(), startOf(), etc.)  
 * It has short-cut functions to work with an Instant (getInstant(), fmtInstant(), getStamp())
 */
export class Instant {
	#date: InstantVars;														// Date parsed into components
	fmt: Record<string, string | number> = {};		// inbuilt Formats

	constructor(dt?: Instant.TYPE, ...args: TArgs) {
		this.#date = this.#parseDate(dt, args);
		for (const fmt in Instant.FORMAT)
			this.fmt[fmt] = this.format(Instant.FORMAT[(fmt as keyof typeof Instant.FORMAT)])
	}

	// Public getters	~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
	/** 4-digit year */														get yy() { return this.#date.yy }
	/** month: Jan=1, Dec=12 */										get mm() { return this.#date.mm }
	/** day of Month */														get dd() { return this.#date.dd }
	/** 24-hour format */													get hh() { return this.#date.hh }
	/** minutes */																get mi() { return this.#date.mi }
	/** seconds */																get ss() { return this.#date.ss }
	/** timestamp */															get ts() { return this.#date.ts }
	/** milliseconds */														get ms() { return this.#date.ms }
	/** number of weeks */												get ww() { return this.#date.ww }
	/** timezone offset */												get tz() { return this.#date.tz }
	/** milliseconds since Unix epoch */					get age() { return this.#date.age }
	/** weekday: Mon=1, Sun=7 */									get dow() { return this.#date.dow }
	/** short month name*/												get mmm() { return Instant.MONTH[this.#date.mm] }
	/** long month name */												get mon() { return Instant.MONTHS[this.#date.mm] }
	/** short weekday name */											get ddd() { return Instant.WEEKDAY[this.#date.dow] }
	/** long weekday name */											get day() { return Instant.WEEKDAYS[this.#date.dow] }
	/** as date string */													get date() { return this.format(Instant.FORMAT.dayDate) }
	/** as time string */													get time() { return this.format('HH:MI:SS') };

	// Public methods	~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
	/** apply formatting */												format = <K extends keyof DateFmt>(fmt: K) => this.#formatDate(fmt);
	/** calc diff Dates, default as \<years> */		diff = (unit: TUnitDiff = 'years', dt2?: Instant.TYPE, ...args: TArgs) => this.#diffDate(unit, dt2, ...args);
	/** format elapsed diff Dates */							elapse = (dt2?: Instant.TYPE, ...args: TArgs) => this.#elapseDate(dt2, ...args);

	/** add date offset, default as \<minutes> */	add = (offset: number, unit: TUnitTime | TUnitDiff = 'minutes') => this.#setDate('add', unit, offset);
	/** start offset, default as \<week> */				startOf = (unit: TUnitTime = 'week') => this.#setDate('start', unit);
	/** middle offset, default as \<week> */			midOf = (unit: TUnitTime = 'week') => this.#setDate('mid', unit);
	/** ending offset, default as \<week> */			endOf = (unit: TUnitTime = 'week') => this.#setDate('end', unit);

	/** valid Instant */													isValid = () => !isNaN(this.#date.ts);
	/** get raw properties */											toJSON = () => ({ ...this.#date });
	/** as Date object */													toDate = () => this.#composeDate(this.#date);
	/** as formatted String object */							toString = () => this.#formatDate(Instant.FORMAT.dayTime);

	// Private methods	~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
	/** parse a Date, return components */
	#parseDate = (dt?: Instant.TYPE, args: TArgs = []) => {
		const orig = dt;																					// stash original value
		const pattern = {
			hhmi: /^([01]\d|2[0-3]):([0-5]\d)( am| pm)?$/,					// regex to match HH:mi
			yyyymmdd: /^(19\d{2}|20\d{2})(0[1-9]|1[012])(0[1-9]|[12][0-9]|3[01])$/,
			yyyyMMMdd: /(19\d{2}|20\d{2})[\/\-\ ]?(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[\/\-\ ]?(0[1-9]|[12][0-9]|3[01])/,			// yyyy-mmm-dd
			ddmmyy: /^([1-9]|0[1-9]|[12][0-9]|3[01])[\/\-]?([1-9]|0[1-9]|1[012])[\/\-]?(\d{2})$/,							// d-m-yy
			ddmmyyyy: /^([1-9]|0[1-9]|[12][0-9]|3[01])[\/\-]?([1-9]|0[1-9]|1[012])[\/\-]?(19\d{2}|20\d{2})$/,	// d-m-yyyy
			ddmmyyyyHHmi: /^([1-9]|0[1-9]|[12][0-9]|3[01])[\/\-]?([1-9]|0[1-9]|1[012])[\/\-]?(19\d{2}|20\d{2}) ([01]\d|2[0-3])(:[0-5]\d)(:[0-5]\d)?/,	// d-m-yyyy {HH:mi|HH:mi:ss}
			isoDate: /^(19\d{2}|20\d{2})-(0[1-9]|1[012])-(0[1-9]|[12][0-9]|3[01])T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)Z$/,
		}
		let date: Date;

		// first, conform the date
		if (isString(dt) && (dt.toLowerCase().endsWith('am') || dt.toLowerCase().endsWith('pm')))
			dt = dt.substring(0, dt.length - 2).trimEnd() + ' ' + dt.substr(-2).toLowerCase();
		if (isString(dt) && pattern.hhmi.test(dt))								// if only HH:mi supplied...
			dt = `${new Date().toDateString()} ${dt}`;							// 	prepend current date
		if ((isString(dt) || isNumber(dt)) && pattern.yyyymmdd.test(asString(dt)))// if yyyymmdd supplied as string...
			dt = asString(dt).replace(pattern.yyyymmdd, '$2/$3/$1 00:00:00');			// format to look like a date-string
		if (isString(dt) && pattern.yyyyMMMdd.test(asString(dt)))
			dt = asString(dt).replace(pattern.yyyyMMMdd, '$3-$2-$1');		// Safari doesn't like ymd
		if ((isString(dt) || isNumber(dt)) && pattern.ddmmyyyy.test(asString(dt)))
			dt = asString(dt).replace(pattern.ddmmyyyy, '$2/$1/$3');		// convert to US format
		if (isString(dt) && pattern.ddmmyy.test(dt))
			dt = dt.replace(pattern.ddmmyy, '$2/$1/$3');								// convert to US format
		if (isString(dt) && pattern.ddmmyyyyHHmi.test(dt))
			dt = dt.replace(pattern.ddmmyyyyHHmi, '$2/$1/$3 $4$5$6');		// convert to US format

		switch (getType(dt)) {																		// convert 'dt' argument into a Date
			case 'Null':																						// special case
				return { value: null } as InstantVars;

			case 'Undefined':
				date = new Date();																		// default to 'now'
				break;

			case 'Date':																						// already is a valid Date
				date = new Date(dt as Date);													// clone a new Date
				break;

			case 'String':
				const day = toProperCase(dt as string);								// check if it is a "WeekDay" only
				if (Instant.WEEKDAY[day as keyof typeof Instant.WEEKDAY] || Instant.WEEKDAYS[day as keyof typeof Instant.WEEKDAYS]) {
					const now = new Date();															// 3-character or full-character Weekday
					now.setDate(now.getDate() - 7 - now.getDay() + Instant.WEEKDAY[day.substring(0, 3) as keyof typeof Instant.WEEKDAY]);
					dt = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`
				}

				const fmt = dt as string;															// cast as string
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
				const vals = args as number[];												// assumed as [mm, dd, HH, mi, ss, ms]
				date = vals.length
					? new Date(nbr, vals[0] - 1, ...vals.slice(1))			// change month-number to zero-indexed
					: new Date(nbr < Instant.DATE.maxStamp && nbr > Instant.TIME.day ? nbr * 1_000 : nbr)// assume timestamp to milliseconds
				break;

			case 'Instant':																					// already have a valid Instant
				date = (dt as Instant).toDate();
				break;

			case 'Object':
				const inst = dt as Instant;														// shape of Instant
				if (isNumber(inst.yy) && isNumber(inst.mm) && isNumber(inst.dd)) {
					date = this.#composeDate(inst);
					break;
				}

			default:																								// unexpected input
				date = new Date();
		}

		if (isNaN(date.getTime()))																// Date not parse-able,
			console.error('Invalid Date: ', orig, dt, date);				// TODO: log the Invalid Date

		const [yy, mm, dd, hh, mi, ss, ts, ms, tz, age, dow] = [
			date.getFullYear(), date.getMonth() + 1, date.getDate(),
			date.getHours(), date.getMinutes(), date.getSeconds(),
			Math.floor(date.getTime() / 1_000), date.getMilliseconds(),
			date.getTimezoneOffset(), date.getTime(), date.getDay() || Instant.WEEKDAY.Sun,
		]

		const thu = date.setDate(dd - dow + Instant.WEEKDAY.Thu);	// set to nearest Thursday
		const ny = new Date(date.getFullYear(), 0, 1).getTime();	// NewYears Day
		const ww = Math.floor((thu - ny) / Instant.TIMES.weeks + 1);	// ISO Week Number

		return { yy, mm, dd, hh, mi, ss, ts, ms, tz, ww, age, dow, value: dt } as InstantVars;
	}

	/** create a new offset Instant */
	#setDate = (mutate: TMutate, unit: TUnitTime | TUnitDiff, offset: number = 1) => {
		const date = { ...this.#date };														// clone the current Instant
		const single = unit.endsWith('s')
			? unit.substring(0, unit.length - 1)										// remove plural units
			: unit
		if (mutate !== 'add')
			[date.hh, date.mi, date.ss, date.ms] = [0, 0, 0, 0];		// discard the time-portion of the date

		switch (`${mutate}.${single}`) {
			case 'start.year':
				[date.mm, date.dd] = [Instant.MONTH.Jan, 1];
			case 'start.month':
				date.dd = 1;
				break;
			case 'start.week':
				date.dd = date.dd - date.dow + Instant.WEEKDAY.Mon;
				break;
			case 'start.day':
				[date.hh, date.mi, date.ss, date.ms] = [0, 0, 0, 0];
				break;
			case 'start.hour':
				[date.mi, date.ss, date.ms] = [0, 0, 0];
				break;
			case 'start.minute':
				[date.ss, date.ms] = [0, 0];
				break;
			case 'start.second':
				date.ms = 0;
				break;

			case 'mid.year':
				[date.mm, date.dd] = [Instant.MONTH.Jul, 1];
				break;
			case 'mid.month':
				date.dd = 15;
				break;
			case 'mid.week':
				date.dd = date.dd - date.dow + Instant.WEEKDAY.Thu;
				break;
			case 'mid.day':
				[date.hh, date.mi, date.ss, date.ms] = [12, 0, 0, 0];
				break;
			case 'mid.hour':
				[date.mi, date.ss, date.ms] = [30, 0, 0];
				break;
			case 'mid.minute':
				[date.ss, date.ms] = [30, 0];
				break;
			case 'mid.second':
				date.ms = 500;
				break;

			case 'end.year':
				[date.mm, date.dd] = [Instant.MONTH.Dec, 31];
				[date.hh, date.mi, date.ss, date.ms] = [23, 59, 59, 999];
				break;
			case 'end.month':
				date.mm += 1;
				date.dd = 0;
				[date.hh, date.mi, date.ss, date.ms] = [23, 59, 59, 999];
				break;
			case 'end.week':
				date.dd = date.dd - date.dow + Instant.WEEKDAY.Sun;
				[date.hh, date.mi, date.ss, date.ms] = [23, 59, 59, 999];
				break;
			case 'end.day':
				[date.hh, date.mi, date.ss, date.ms] = [23, 59, 59, 999];
				break;
			case 'end.hour':
				[date.mi, date.ss, date.ms] = [59, 59, 999];
				break;
			case 'end.minute':
				[date.ss, date.ms] = [59, 999];
				break;
			case 'end.second':
				[date.ms] = [999];
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
				date.hh += offset;
				break;
			case 'add.minute':
				date.mi += offset;
				break;
			case 'add.second':
				date.ss += offset;
				break;
			case 'add.millisecond':
				date.ms += offset;
				break;
		}

		return new Instant(this.#composeDate(date));
	}

	/** compose a Date() from an Instant() */
	#composeDate = (date: InstantVars) =>
		new Date(date.yy, date.mm - 1, date.dd, date.hh, date.mi, date.ss, date.ms);

	/** combine Instant components to apply some standard & free-format rules */
	#formatDate = <K extends keyof DateFmt>(fmt: K): DateFmt[K] => {
		const date = { ...this.#date };													// clone current Instant

		switch (fmt) {
			case Instant.FORMAT.yearWeek:
				const offset = date.ww === 1 && date.mm === Instant.MONTH.Dec;			// if late-Dec, add 1 to yy
				return asNumber(`${date.yy + Number(offset)}${fix(date.ww)}`);

			case Instant.FORMAT.yearMonth:
				return asNumber(`${fix(date.yy)}${fix(date.mm)}`);

			case Instant.FORMAT.yearMonthDay:
				return asNumber(`${date.yy}${fix(date.mm)}${fix(date.dd)}`);

			default:
				const am = asString(fmt).includes('hh:')						// if 'twelve-hour' is present in fmtString
					? date.hh >= 12 ? 'pm' : 'am'											// noon is considered 'pm'
					: ''

				return asString(fmt)
					.replace(/y{4}/g, fix(date.yy))
					.replace(/y{2}/g, fix(date.yy).substring(2, 4))
					.replace(/m{3}/g, this.mmm)
					.replace(/m{2}/g, fix(date.mm))
					.replace(/d{3}/g, this.ddd)
					.replace(/d{2}/g, fix(date.dd))
					.replace(/H{2}/g, fix(date.hh))
					.replace(/MI/g, fix(date.mi))
					.replace(/S{2}/g, fix(date.ss))
					.replace(/h{2}$/g, fix(date.hh >= 13 ? date.hh % 12 : date.hh) + am)
					.replace(/h{2}/g, fix(date.hh >= 13 ? date.hh % 12 : date.hh))
					.replace(/mi$/g, fix(date.mi) + am)								// add 'am' if 'mi' at end of fmtString, and it follows 'hh'
					.replace(/mi/g, fix(date.mi))
					.replace(/s{2}$/g, fix(date.ss) + am)							// add 'am' if 'ss' at end of fmtString, and it follows 'hh'
					.replace(/s{2}/g, fix(date.ss))
					.replace(/ts/g, asString(date.ts))
					.replace(/ms/g, fix(date.ms, 3))
					.replace(/w{2}/g, asString(date.ww))
					.replace(/dow/g, asString(date.dow))
					.replace(/day/g, asString(this.day))
		}
	}

	/**
	 * a fmt string contains '%' markers plus Instant components.  
	 * args contains array of values that will replace the marker-components.  
	 * this will return a new Date based on the interpolated fmt string.  
	 * e.g. ('%dd-%mmm', 20, 'May') will return new Date() for 20-May in current year.
	 */
	#formatString = (fmt: string, ...args: TArgs) => {
		const date = new Instant().startOf('day').toJSON()					// date components
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
						date.hh = hour % 12 + (str.endsWith('pm') || hour > 12 ? 1 : 0);
						break;
					case word2 === 'HH':
					case word2 === 'hh':
						date.hh = num;
						break;
					case word2 === 'MM':
					case word2 === 'MI':
					case word2 === 'mi':
						date.mi = num;
						break;
					case word2 === 'SS':
					case word2 === 'ss':
						date.ss = num;
						break;

					default:
						argCnt -= 1;
				}
				argCnt += 1;
			})

		return this.#composeDate(date);
	}

	/** calculate the difference between dates (past is positive, future is negative) */
	#diffDate = (unit: TUnitDiff = 'years', dt2?: Instant.TYPE, ...args: TArgs) => {
		const offset = this.#parseDate(dt2, args);
		const diff = this.#date.age - offset.age;

		return diff < 0
			? Math.ceil(diff / Instant.TIMES[unit])
			: Math.floor(diff / Instant.TIMES[unit])
	}

	/** format the elapsed time between two dates */
	#elapseDate = (dt2?: Instant.TYPE, ...args: TArgs) => {
		const offset = this.#parseDate(dt2, args);
		let diff = offset.age - this.#date.age;

		const dd = Math.floor(diff / Instant.TIMES.days);
		diff -= dd * Instant.TIMES.days;

		const hh = Math.floor(diff / Instant.TIMES.hours) % 24;
		diff -= hh * Instant.TIMES.hours;

		const mm = Math.floor(diff / Instant.TIMES.minutes) % 60;
		diff -= mm * Instant.TIMES.minutes;

		const ss = Math.floor(diff / Instant.TIMES.seconds);
		diff -= ss * Instant.TIMES.seconds;

		return dd
			? fix(dd) + ':' + fix(hh) + ':' + fix(mm) + ':' + fix(ss) + '.' + fix(diff, 3)
			: hh
				? fix(hh) + ':' + fix(mm) + ':' + fix(ss) + '.' + fix(diff, 3)
				: fix(mm) + ':' + fix(ss) + '.' + fix(diff, 3)
	}
}

export namespace Instant {
	export type TYPE = string | number | Date | Instant | null;

	export interface TypeFmt {
		"display": string;
		"dayTime": string;
		"dayFull": string;
		"sortTime": string;
		"monthTime": string;
		"monthDate": string;
		"dayMonth": string;
		"HHmi": string;
		"hhmi": string;
		"log": string;
		"yearWeek": number;
		"yearMonth": number;
		"yearMonthDay": number;
	}

	export enum WEEKDAY { All, Mon, Tue, Wed, Thu, Fri, Sat, Sun };
	export enum WEEKDAYS { Everyday, Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday };
	export enum MONTH { All, Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec };
	export enum MONTHS { Every, January, February, March, April, May, June, July, August, September, October, November, December };
	export enum DURATION { year, month, week, day, hour, minute, second };
	export enum DURATIONS { years, months, weeks, days, hours, minutes, seconds };

	export enum FORMAT {											// pre-configured format names
		display = 'ddd, dd mmm yyyy',
		dayTime = 'ddd, yyyy-mmm-dd HH:MI',
		dayFull = 'ddd, yyyy-mmm-dd HH:MI:SS',	// useful for Sheets cell-format
		dayMonth = 'dd-mmm',
		dayDate = 'ddd, yyyy-mmm-dd',
		sortTime = 'yyyy-mm-dd HH:MI',					// useful for sorting display-strings
		monthTime = 'yyyy-mmm-dd HH:MI',				// useful for dates where dow is not needed
		monthDate = 'yyyy-mmm-dd',
		HHMI = 'HH:MI',													// 24-hour format
		hhmi = 'hh:mi',													// 12-hour format
		log = 'HH:MI:SS.ms',										// useful for log-stamping
		yearWeek = 'yyyyww',
		yearMonth = 'yyyymm',
		yearMonthDay = 'yyyymmdd',
	}

	/** number of seconds per unit-of-time */
	export enum TIME {
		year = 31_536_000,
		month = 2_628_000,
		week = 604_800,
		day = 86_400,
		hour = 3_600,
		minute = 60,
		second = 1,
		millisecond = .001,
	}

	/** number of milliseconds per unit-of-time */
	export enum TIMES {
		years = TIME.year * 1_000,
		months = TIME.month * 1_000,
		weeks = TIME.week * 1_000,
		days = TIME.day * 1_000,
		hours = TIME.hour * 1_000,
		minutes = TIME.minute * 1_000,
		seconds = TIME.second * 1_000,
		milliseconds = TIME.millisecond * 1_000,
	}

	/** some useful Dates */
	export const DATE = {
		epoch: new Date(0).getTime(),
		maxStamp: new Date('9999-12-31').getTime() / 1_000,
		minStamp: new Date('1000-01-01').getTime() / 1_000,
		maxDate: new Date('9999-12-31'),
		minDate: new Date('1000-01-01'),
	}
}
