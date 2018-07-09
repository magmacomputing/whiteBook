import * as moment from 'moment';
import { toNumeric } from '@lib/string.library';
import { DATE_FMT, MOMENT_FMT, IDate } from '@lib/date.define';

/** Helper functions to standardize Date/Time formats */

const getMoment = (dt?: any, fmt: string | string[] = MOMENT_FMT): moment.Moment =>
  dt ? moment(dt, fmt) : moment(moment.now());

export const fmtDate = (dt?: any, fmt: string | string[] = MOMENT_FMT): IDate => {
  const mmt = moment.isMoment(dt) ? dt : getMoment(dt, fmt);
  const obj = {} as IDate;

  (Object.keys(DATE_FMT) as (keyof IDate)[])
    .forEach(key => obj[key] = toNumeric(mmt.clone().format(DATE_FMT[key])));
  return obj;
}

export const getStamp = (dt?: any, fmt: string | string[] = MOMENT_FMT) =>
  toNumeric(getMoment(dt, fmt).format(DATE_FMT.stamp)) as number;
