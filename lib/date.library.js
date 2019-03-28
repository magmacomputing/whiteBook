import { fix } from '@lib/number.library';
import { isString, isNumber, getType } from '@lib/type.library';
export var DATE_FMT;
(function (DATE_FMT) {
    DATE_FMT["yearMonthDay"] = "yearMonthDay";
    DATE_FMT["HHmi"] = "HHmi";
    DATE_FMT["stamp"] = "stamp";
    DATE_FMT["display"] = "display";
    DATE_FMT["dayMonth"] = "dayMonth";
    DATE_FMT["dateTime"] = "dateTime";
    DATE_FMT["Date"] = "Date";
})(DATE_FMT || (DATE_FMT = {}));
export var DAY;
(function (DAY) {
    DAY[DAY["Mon"] = 1] = "Mon";
    DAY[DAY["Tue"] = 2] = "Tue";
    DAY[DAY["Wed"] = 3] = "Wed";
    DAY[DAY["Thu"] = 4] = "Thu";
    DAY[DAY["Fri"] = 5] = "Fri";
    DAY[DAY["Sat"] = 6] = "Sat";
    DAY[DAY["Sun"] = 7] = "Sun";
})(DAY || (DAY = {}));
export var MONTH;
(function (MONTH) {
    MONTH[MONTH["Jan"] = 1] = "Jan";
    MONTH[MONTH["Feb"] = 2] = "Feb";
    MONTH[MONTH["Mar"] = 3] = "Mar";
    MONTH[MONTH["Apr"] = 4] = "Apr";
    MONTH[MONTH["May"] = 5] = "May";
    MONTH[MONTH["Jun"] = 6] = "Jun";
    MONTH[MONTH["Jul"] = 7] = "Jul";
    MONTH[MONTH["Aug"] = 8] = "Aug";
    MONTH[MONTH["Sep"] = 9] = "Sep";
    MONTH[MONTH["Oct"] = 10] = "Oct";
    MONTH[MONTH["Nov"] = 11] = "Nov";
    MONTH[MONTH["Dec"] = 12] = "Dec";
})(MONTH || (MONTH = {}));
const hhmi = /^\d\d:\d\d$/; // regex to match HH:MI
const yyyymmdd = /^(19\d{2}|20\d{2})(0[1-9]|1[012])(0[1-9]|[12][0-9]|3[01])$/; // regex to match YYYYMMDD
const divideBy = {
    years: 31536000,
    months: 2628000,
    weeks: 604800,
    days: 86400,
    hours: 3600,
    minutes: 60,
    seconds: 1,
};
// High-date / Low-Dates
const maxTS = new Date('9999-12-31').valueOf() / 1000;
const minTS = new Date('1000-01-01').valueOf() / 1000;
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
/** shortcut functions to common Instant class properties / methods */
const isInstant = (dt) => getType(dt) === 'Instant';
/** get new Instant */ export const getDate = (dt) => new Instant(dt);
/** get ms Timestamp*/ export const getStamp = (dt) => (isInstant(dt) ? dt : new Instant(dt)).ts;
/** format a Date */ export const fmtDate = (fmt, dt) => (isInstant(dt) ? dt : new Instant(dt)).format(fmt);
/** parse a Date, return components and methods */
class Instant {
    constructor(dt) {
        /** apply formatting*/ this.format = (fmt) => this.formatDate(fmt);
        /** calc diff Dates */ this.diff = (unit = 'years', dt2) => this.diffDate(dt2, unit);
        /** add date offset */ this.add = (offset, unit = 'minutes') => this.setDate('add', unit, offset);
        /** start offset */ this.startOf = (unit = 'week') => this.setDate('start', unit);
        /** ending offset */ this.endOf = (unit = 'week') => this.setDate('end', unit);
        /** is Instant valid*/ this.isValid = () => !isNaN(this.date.ts);
        /** break a Date into components */
        this.parseDate = (dt) => {
            if (isString(dt) && hhmi.test(dt)) // if only HH:MI supplied...
                dt = new Date().toDateString() + ' ' + dt; // 	prepend current date
            if (isString(dt) && yyyymmdd.test(dt)) // if yyyymmdd supplied as string...
                dt = dt.replace(yyyymmdd, '$1-$2-$3 00:00:00'); //  format to look like a date-string
            if (isNumber(dt) && yyyymmdd.test(dt.toString())) // if yyyymmdd supplied as number...
                dt = dt.toString().replace(yyyymmdd, '$1-$2-$3 00:00:00');
            let date;
            switch (getType(dt)) { // translate supplied parameter into a Date
                case 'Undefined': // set to 'now'
                    date = new Date();
                    break;
                case 'Date': // already a valid Date
                    date = dt;
                    break;
                case 'Instant': // turn Instant back into a date-string
                    date = new Date(dt.format(DATE_FMT.dateTime));
                    break;
                case 'String':
                    date = new Date(dt); // attempt to parse date-string
                    break;
                case 'Number': // check whether milliseconds or microseconds
                    const nbr = dt;
                    const val = (nbr < maxTS ? nbr * 1000 : nbr); // assume timestamp to milliseconds
                    date = new Date(val);
                    break;
                default: // unexpected input
                    date = new Date();
            }
            if (isNaN(date.getTime()))
                console.log('Invalid Date: ', dt, date); // log the Invalid Date
            let [yy, mm, dd, wd, HH, MI, SS, ts] = [
                date.getFullYear(), date.getMonth(), date.getDate(), date.getDay(),
                date.getHours(), date.getMinutes(), date.getSeconds(), Math.round(date.getTime() / 1000),
            ];
            mm += 1; // ISO month
            if (!wd && !isNaN(wd))
                wd = DAY.Sun; // ISO weekday
            const thu = date.setDate(dd + DAY.Thu - wd) / 1000; // set to nearest Thursday
            const ny = new Date(date.getFullYear(), 0, 1).valueOf() / 1000; // NewYear Date
            const ww = Math.floor((thu - ny) / divideBy.weeks + 1); // calc Week Number
            return { yy, mm, dd, wd, ww, HH, MI, SS, ts, mn: MONTH[mm], dn: DAY[wd] };
        };
        /** mutate an Instant */
        this.setDate = (mutate, unit, offset) => {
            const date = { ...this.date }; // clone the current Instant
            if (mutate !== 'add')
                [date.HH, date.MI, date.SS] = [0, 0, 0]; // discard the time-portion of the date
            switch (`${mutate}.${unit}`) {
                case 'start.day':
                    break;
                case 'end.day':
                    [date.HH, date.MI, date.SS] = [23, 59, 59];
                    break;
                case 'start.week':
                    date.dd = date.dd - date.wd + DAY.Mon;
                    break;
                case 'start.month':
                    date.dd = 1;
                    break;
                case 'end.week':
                    date.dd = date.dd - date.wd + DAY.Sun;
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
        };
        /** combine Instant components to apply some standard format rules */
        this.formatDate = (fmt) => {
            const date = { ...this.date }; // clone current Instant
            switch (fmt) {
                case DATE_FMT.HHmi:
                    return `${fix(date.HH)}:${fix(date.MI)}`;
                case DATE_FMT.yearMonthDay:
                    return parseInt(`${date.yy}${fix(date.mm)}${fix(date.dd)}`, 10);
                case DATE_FMT.stamp:
                    return date.ts;
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
        };
        /** calculate the difference between dates */
        this.diffDate = (dt2, unit = 'years') => Math.floor((this.parseDate(dt2).ts - this.date.ts) / divideBy[unit]);
        this.date = this.parseDate(dt);
    }
    /** 4-digit year */ get yy() { return this.date.yy; }
    /** month number */ get mm() { return this.date.mm; }
    /** short month name*/ get mn() { return this.date.mn; }
    /** day number */ get dd() { return this.date.dd; }
    /** short day name */ get dn() { return this.date.dn; }
    /** 24-hour format */ get HH() { return this.date.HH; }
    /** minute */ get MM() { return this.date.MI; }
    /** minute */ get MI() { return this.date.MI; }
    /** seconds */ get SS() { return this.date.SS; }
    /** weekday number */ get wd() { return this.date.wd; }
    /** number of weeks*/ get ww() { return this.date.ww; }
    /** unix timestamp */ get ts() { return this.date.ts; }
}
