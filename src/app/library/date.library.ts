import * as moment from 'moment';

import { DATE_FMT, MOMENT_FMT, IDate } from '@lib/date.define';
import { TString, isString } from '@lib/type.library';
import { toNumeric } from '@lib/string.library';
import { isNumber } from 'util';

/** Helper functions to standardize Date/Time formats */

export const getMoment = (dt?: string | number | moment.Moment, fmt: TString = MOMENT_FMT) =>
	dt ? moment(dt, fmt) : moment(moment.now());

export const fmtDate = (key: keyof IDate, dt?: string | number | moment.Moment, fmt: TString = MOMENT_FMT) =>
	toNumeric(getMoment(dt, fmt).format(DATE_FMT[key]));

// shortcut to fmtDate('stamp', ...)
export const getStamp = (dt?: string | number, fmt: TString = MOMENT_FMT) =>
	fmtDate('stamp', dt, fmt) as number;

const fmtMoment = (dt?: any, fmt: TString = MOMENT_FMT): IDate => {
	const mmt = moment.isMoment(dt) ? dt : getMoment(dt, fmt);
	const obj = {} as IDate;

	(Object.keys(DATE_FMT) as (keyof IDate)[])
		.forEach(key => obj[key] = toNumeric(mmt.clone().format(DATE_FMT[key])));
	return obj;
}

export const getDateDiff = (date?: string | number, unit: moment.unitOfTime.Diff = 'years') =>
	isString(date) || isNumber(date)
		? moment().diff(getMoment(date), unit)
		: 0
