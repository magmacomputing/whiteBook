import * as moment from 'moment';

import { DATE_FMT, MOMENT_FMT, IDate } from '@lib/date.define';
import { TString } from '@lib/type.library';
import { toNumeric } from '@lib/string.library';
import { isNumber } from 'util';

type TDate = string | number | moment.Moment;

/** Helper functions to standardize Date/Time formats */

const getMoment = (dt?: TDate, fmt: TString = MOMENT_FMT) =>
	dt ? moment(dt, fmt) : moment(moment.now());

export const fmtDate = (key: keyof IDate, dt?: TDate, fmt: TString = MOMENT_FMT) =>
	toNumeric(getMoment(dt, fmt).format(DATE_FMT[key]));

// shortcut
export const getStamp = (dt?: TDate, fmt: TString = MOMENT_FMT) =>
	fmtDate('stamp', dt, fmt) as number;

// toNumeric(getMoment(dt, fmt).format(DATE_FMT.stamp)) as number;


const fmtMoment = (dt?: any, fmt: TString = MOMENT_FMT): IDate => {
	const mmt = moment.isMoment(dt) ? dt : getMoment(dt, fmt);
	const obj = {} as IDate;

	(Object.keys(DATE_FMT) as (keyof IDate)[])
		.forEach(key => obj[key] = toNumeric(mmt.clone().format(DATE_FMT[key])));
	return obj;
}

export const getDateDiff = (date: number, unit: moment.unitOfTime.Diff = 'years') =>
	isNumber(date)
		? moment().diff(getMoment(date * 1000), unit)
		: undefined
