import * as moment from 'moment';

import { TString, isString, isNumber } from '@lib/type.library';
import { toNumeric, asString } from '@lib/string.library';

export interface IDate {
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

export const DATE_KEY: Record<keyof IDate, keyof IDate> = {
	cell: 'cell',
	short: 'short',
	display: 'display',
	hourMin: 'hourMin',
	human: 'human',
	yearMonth: 'yearMonth',
	yearMonthDay: 'yearMonthDay',
	yearMonthSep: 'yearMonthSep',
	yearMonthDaySep: 'yearMonthDaySep',
	yearWeek: 'yearWeek',
	dayMonthSep: 'dayMonthSep',
	dayMonthSpace: 'dayMonthSpace',
	dayMonthYearSep: 'dayMonthYearSep',
	dayMonthYear: 'dayMonthYear',
	week: 'week',
	weekDay: 'weekDay',
	day: 'day',
	dayZZ: 'dayZZ',
	time: 'time',
	HHmm: 'HHmm',
	stamp: 'stamp',
	ms: 'ms',
	log: 'log',
	elapse: 'elapse',
};

/** an array of formats for Moment() to try against a string Date */
const MOMENT_FMT = [
	DATE_FMT.dayMonthYear,
	DATE_FMT.yearMonthDay,
	DATE_FMT.yearMonthDaySep,
	DATE_FMT.dayMonthYearSep,
	DATE_FMT.stamp,
	DATE_FMT.time,
];

/** get a moment object */
export const getMoment = (dt?: string | number | moment.Moment, fmt: TString = MOMENT_FMT) =>
	dt ? moment(dt, fmt) : moment(moment.now());

/** format a date by a specified 'key' */
export const fmtDate = <T>(dt?: string | number | moment.Moment, key: keyof IDate = 'yearMonthDay', fmt: TString = MOMENT_FMT) =>
	toNumeric(getMoment(dt, fmt).format(DATE_FMT[key])) as T extends string ? string : number

/** shortcut to fmtDate('stamp', ...) */
export const getStamp = (dt?: string | number, fmt: TString = MOMENT_FMT) =>
	fmtDate(dt, DATE_KEY.stamp, fmt)

/** useful when we want an Object with *all* formats available */
const fmtMoment = (dt?: any, fmt: TString = MOMENT_FMT): IDate => {
	const mmt = moment.isMoment(dt) ? dt : getMoment(dt, fmt);
	const obj = {} as IDate;

	(Object.keys(DATE_FMT) as (keyof IDate)[])
		.forEach(key => obj[key] = toNumeric(mmt.clone().format(DATE_FMT[key])));
	return obj;
}

/** get integer difference between supplied date and now (default unit is 'years') */
export const diffDate = (date?: string | number, unit: moment.unitOfTime.Diff = 'years') =>
	isString(date) || isNumber(date)
		? moment().diff(getMoment(date), unit)
		: 0

export const addDate = (date: string | number, fmt: keyof IDate, offset: number = 0, unit: moment.unitOfTime.Diff = 'minutes') =>
	isString(date) || isNumber(date)
		? getMoment(date, DATE_FMT[fmt]).add(offset, unit).format(DATE_FMT[fmt])
		: asString(date)