import { fix } from '@lib/number.library';
import { asString, asNumber } from '@lib/string.library';
import { isString, isNumber, getType, isUndefined } from '@lib/type.library';
;
export var DATE_FMT;
(function (DATE_FMT) {
    DATE_FMT["display"] = "ddd, dd mmm yyyy";
    DATE_FMT["dateTime"] = "yyyy-mm-dd HH:MI";
    DATE_FMT["dayMonth"] = "dd-mmm";
    DATE_FMT["HHMI"] = "HH:MI";
    DATE_FMT["yearWeek"] = "yyyyww";
    DATE_FMT["yearMonth"] = "yyyymm";
    DATE_FMT["yearMonthDay"] = "yyyymmdd";
})(DATE_FMT || (DATE_FMT = {}));
/** Mirror the Firestore Timestamp */
class Timestamp {
    constructor(seconds, nanoseconds) {
        this.toDate = () => new Date((this.seconds * 1000) + Math.floor(this.nanoseconds / 1000000));
        const now = new Date();
        this.seconds = isUndefined(seconds)
            ? now.getSeconds()
            : seconds;
        this.nanoseconds = isUndefined(nanoseconds)
            ? now.getMilliseconds() * 1000000
            : nanoseconds;
    }
}
Timestamp.fromDate = (dt) => new Timestamp(dt.getSeconds(), dt.getMilliseconds() * 1000000);
Timestamp.fromStamp = (stamp) => Timestamp.fromDate(new Date(stamp * 1000));
Timestamp.now = new Timestamp();
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// shortcut functions to common Instant class properties / methods.
/** get new Instant */ export const getDate = (dt, ...args) => new Instant(dt, ...args);
/** get Timestamp */ export const getStamp = (dt, ...args) => getDate(dt, ...args).ts;
/** format Instant */ export const fmtDate = (fmt, dt, ...args) => getDate(dt, ...args).format(fmt);
/**
 * An Instant is a object that is used to manage Javascript Dates.
 * It has properties that break a Date into components ('yy', 'dd', etc.)
 * It has methods to perform Date manipulations (add(), format(), diff(), startOf(), etc.)
 * It has short-cut functions to work with an Instant (getDate(), getStamp(), fmtDate())
 */
export class Instant {
    constructor(dt, ...args) {
        // Public methods	~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        /** apply formatting*/
        this.format = (fmt) => this.formatDate(fmt);
        /** calc diff Dates, default as <years> */
        this.diff = (unit = 'years', dt2, ...args) => this.diffDate(unit, dt2, ...args);
        /** add date offset, default as <minutes> */
        this.add = (offset, unit = 'minutes') => this.setDate('add', unit, offset);
        /** start offset, default as <week> */
        this.startOf = (unit = 'week') => this.setDate('start', unit);
        /** middle offset, default as <week> */
        this.midOf = (unit = 'week') => this.setDate('mid', unit);
        /** ending offset, default as <week> */
        this.endOf = (unit = 'week') => this.setDate('end', unit);
        /** valid Instant */ this.isValid = () => !isNaN(this.date.ts);
        /** get raw object */ this.asObject = () => (Object.assign({}, this.date));
        /** as Date object */ this.asDate = () => new Date(this.date.ts * 1000 + this.date.ms);
        // Private methods	~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        /** parse a Date, return components */
        this.parseDate = (dt, args = []) => {
            let date;
            if (isString(dt) && Instant.hhmi.test(dt)) // if only HH:MI supplied...
                dt = `${new Date().toDateString()} ${dt}`; // 	prepend current date
            if ((isString(dt) || isNumber(dt)) && Instant.yyyymmdd.test(asString(dt))) // if yyyymmdd supplied as string...
                dt = asString(dt).replace(Instant.yyyymmdd, '$1-$2-$3 00:00:00'); // format to look like a date-string
            switch (getType(dt)) { // convert 'dt' argument into a Date
                case 'Undefined': // default to 'now'
                    date = new Date();
                    break;
                case 'Date': // already is a valid Date	
                    date = dt;
                    break;
                case 'String':
                    const fmt = dt;
                    date = args.length
                        ? this.formatString(fmt, ...args) // free-format string
                        : new Date(fmt); // let browser interpret string
                    if (date.getFullYear() === 2001) { // Javascript default year, if none in parse-string
                        if (!fmt.includes('2001')) // did not specifically request default year
                            date.setFullYear(new Date().getFullYear()); // so, override to current year
                    }
                    break;
                case 'Number': // could be timestamp, or (with args) date-components
                    const nbr = dt;
                    const vals = args; // assumed as [MM, DD, HH, MI, SS, ms]
                    date = vals.length
                        ? new Date(nbr, vals[0] - 1, ...vals.slice(1)) // change month-number to zero-indexed
                        : new Date(nbr < Instant.maxStamp ? nbr * 1000 : nbr); // assume timestamp to milliseconds
                    break;
                case 'Instant': // already have a valid Instant
                    date = dt.asDate();
                    break;
                case 'Timestamp': // instance of Timestamp
                    date = dt.toDate();
                    break;
                case 'Object':
                    const ts = dt; // shape of Timestamp
                    const obj = dt; // shape of Instant
                    if (isNumber(ts.seconds) && isNumber(ts.nanoseconds)) {
                        date = new Timestamp(ts.seconds, ts.nanoseconds).toDate();
                        break;
                    }
                    if (isNumber(obj.yy) && isNumber(obj.mm) && isNumber(obj.dd)) {
                        date = this.composeDate(obj);
                        break;
                    }
                default: // unexpected input
                    date = new Date();
            }
            if (isNaN(date.getTime())) // Date not parse-able,
                console.error('Invalid Date: ', dt, date); // TODO: log the Invalid Date
            let [yy, mm, dd, HH, MI, SS, ts, ms, dow] = [
                date.getFullYear(), date.getMonth(), date.getDate(),
                date.getHours(), date.getMinutes(), date.getSeconds(),
                Math.floor(date.getTime() / 1000), date.getMilliseconds(), date.getDay(),
            ];
            mm += 1; // ISO month
            if (!dow && !isNaN(dow))
                dow = Instant.DAY.Sun; // ISO weekday
            const thu = date.setDate(dd - dow + Instant.DAY.Thu); // set to nearest Thursday
            const ny = new Date(date.getFullYear(), 0, 1).valueOf(); // NewYears Day
            const ww = Math.floor((thu - ny) / Instant.divideBy.weeks + 1); // ISO Week Number
            return { yy, mm, dd, HH, MI, SS, ts, ms, ww, dow, ddd: Instant.DAY[dow], mmm: Instant.MONTH[mm], value: dt };
        };
        /** mutate an Instant */
        this.setDate = (mutate, unit, offset = 1) => {
            const date = Object.assign({}, this.date); // clone the current Instant
            const single = unit.endsWith('s')
                ? unit.substring(0, unit.length - 1) // remove plural units
                : unit;
            if (mutate !== 'add')
                [date.HH, date.MI, date.SS, date.ms] = [0, 0, 0, 0]; // discard the time-portion of the date
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
                case 'add.year':
                    date.yy += offset;
                    break;
                case 'add.month':
                    date.mm += offset;
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
                case 'add.week':
                    date.dd += offset * 7;
                    break;
            }
            return new Instant(this.composeDate(date));
        };
        this.composeDate = (date) => new Date(date.yy, date.mm - 1, date.dd, date.HH, date.MI, date.SS, date.ms);
        /** combine Instant components to apply some standard / free-format rules */
        this.formatDate = (fmt) => {
            const date = Object.assign({}, this.date); // clone current Instant
            switch (fmt) {
                case DATE_FMT.yearWeek:
                    const offset = date.ww === 1 && date.mm === 12; // if late-Dec, add 1 to yy
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
                        .replace(/dow/g, asString(date.dow));
            }
        };
        /**
         * a fmt string contains '%' markers plus Instant components.
         * args contains array of values that will replace the marker-components.
         * this will return a new Date based on the interpolated fmt string.
         * e.g. ('%dd-%mmm', 20, 'May') will return new Date() for 20-May in current year.
         */
        this.formatString = (fmt, ...args) => {
            const date = new Instant().startOf('day').asObject(); // date components
            let cnt = 0;
            fmt.split('%')
                .forEach(word => {
                const word4 = word.substring(0, 4), word3 = word.substring(0, 3), word2 = word.substring(0, 2);
                let param = args[cnt];
                switch (true) {
                    case word2 === 'yy' && word4 !== 'yyyy':
                        param = parseInt('20' + param) < (date.yy + 10)
                            ? '20' + param // if less than ten-years, assume this century
                            : '19' + param; // if more than ten-years, assume last century
                    case word4 === 'yyyy':
                        date.yy = asNumber(param);
                        break;
                    case word3 === 'mmm': // change the month-name into a month-number
                        param = Instant.MONTH[param];
                    case word2 === 'mm':
                        date.mm = asNumber(param);
                        break;
                    case word3 === 'ddd': // set the day to the last occurrence of %ddd
                        let weekDay = Instant.DAY[param];
                        param = (date.dd - date.dow + weekDay).toString();
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
                        date.SS = asNumber(param);
                        break;
                    default:
                        cnt -= 1;
                }
                cnt += 1;
            });
            return this.composeDate(date);
        };
        /** calculate the difference between dates */
        this.diffDate = (unit = 'years', dt2, ...args) => {
            const offset = this.parseDate(dt2, args);
            return Math.floor(((offset.ts * 1000 + offset.ms) - (this.date.ts * 1000 + this.date.ms)) / Instant.divideBy[unit]);
        };
        this.date = this.parseDate(dt, args);
    }
    // Public getters	~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    /** 4-digit year */ get yy() { return this.date.yy; }
    /** month number */ get mm() { return this.date.mm; }
    /** day number */ get dd() { return this.date.dd; }
    /** 24-hour format */ get HH() { return this.date.HH; }
    /** minutes */ get MI() { return this.date.MI; }
    /** seconds */ get SS() { return this.date.SS; }
    /** timestamp */ get ts() { return this.date.ts; }
    /** milliseconds */ get ms() { return this.date.ms; }
    /** number of weeks*/ get ww() { return this.date.ww; }
    /** weekday number */ get dow() { return this.date.dow; }
    /** short day name */ get ddd() { return this.date.ddd; }
    /** short month name*/ get mmm() { return this.date.mmm; }
}
(function (Instant) {
    let DAY;
    (function (DAY) {
        DAY[DAY["Mon"] = 1] = "Mon";
        DAY[DAY["Tue"] = 2] = "Tue";
        DAY[DAY["Wed"] = 3] = "Wed";
        DAY[DAY["Thu"] = 4] = "Thu";
        DAY[DAY["Fri"] = 5] = "Fri";
        DAY[DAY["Sat"] = 6] = "Sat";
        DAY[DAY["Sun"] = 7] = "Sun";
    })(DAY = Instant.DAY || (Instant.DAY = {}));
    let WEEKDAY;
    (function (WEEKDAY) {
        WEEKDAY[WEEKDAY["Monday"] = 1] = "Monday";
        WEEKDAY[WEEKDAY["Tuesday"] = 2] = "Tuesday";
        WEEKDAY[WEEKDAY["Wednesday"] = 3] = "Wednesday";
        WEEKDAY[WEEKDAY["Thursday"] = 4] = "Thursday";
        WEEKDAY[WEEKDAY["Friday"] = 5] = "Friday";
        WEEKDAY[WEEKDAY["Saturday"] = 6] = "Saturday";
        WEEKDAY[WEEKDAY["Sunday"] = 7] = "Sunday";
    })(WEEKDAY = Instant.WEEKDAY || (Instant.WEEKDAY = {}));
    let MONTH;
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
    })(MONTH = Instant.MONTH || (Instant.MONTH = {}));
    let MONTHS;
    (function (MONTHS) {
        MONTHS[MONTHS["January"] = 1] = "January";
        MONTHS[MONTHS["February"] = 2] = "February";
        MONTHS[MONTHS["March"] = 3] = "March";
        MONTHS[MONTHS["April"] = 4] = "April";
        MONTHS[MONTHS["May"] = 5] = "May";
        MONTHS[MONTHS["June"] = 6] = "June";
        MONTHS[MONTHS["July"] = 7] = "July";
        MONTHS[MONTHS["August"] = 8] = "August";
        MONTHS[MONTHS["September"] = 9] = "September";
        MONTHS[MONTHS["October"] = 10] = "October";
        MONTHS[MONTHS["November"] = 11] = "November";
        MONTHS[MONTHS["December"] = 12] = "December";
    })(MONTHS = Instant.MONTHS || (Instant.MONTHS = {}));
    Instant.hhmi = /^\d\d:\d\d$/; // regex to match HH:MI
    Instant.yyyymmdd = /^(19\d{2}|20\d{2})(0[1-9]|1[012])(0[1-9]|[12][0-9]|3[01])$/; // regex to match YYYYMMDD
    Instant.ddmmyyyy = /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[012])\/(19\d{2}|20\d{2})$/;
    Instant.maxStamp = new Date('9999-12-31').valueOf() / 1000;
    Instant.minStamp = new Date('1000-01-01').valueOf() / 1000;
    Instant.divideBy = {
        years: 31536000000,
        months: 2628000000,
        weeks: 604800000,
        days: 86400000,
        hours: 3600000,
        minutes: 60000,
        seconds: 1000,
    };
})(Instant || (Instant = {}));
