"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};

var DATE_FMT;
(function (DATE_FMT) {
    DATE_FMT["yearMonthDay"] = "yearMonthDay";
    DATE_FMT["weekDay"] = "weekDay";
    DATE_FMT["HHmm"] = "HHmm";
    DATE_FMT["stamp"] = "stamp";
    DATE_FMT["display"] = "display";
})(DATE_FMT = DATE_FMT || (DATE_FMT = {}));
;
var DATE_KEY = {
    cell: 'ddd, YYYY-MMM-DD HH:mm:ss',
    short: 'ddd, YYYY-MMM-DD',
    display: 'YYYY-MM-DD HH:mm:ss',
    hourMin: 'YYYY-MMM-DD HH:mm',
    human: 'ddd, DD MMM YYYY',
    yearMonth: 'YYYYMM',
    yearMonthDay: 'YYYYMMDD',
    yearMonthSep: 'YYYY-MM',
    yearMonthDaySep: 'YYYY-MMM-DD',
    yearWeek: 'GGGGWW',
    dayMonthSep: 'DD-MMM',
    dayMonthSpace: 'DD MMM',
    dayMonthYearSep: 'DD-MMM-YYYY',
    dayMonthYear: 'DD/MM/YYYY',
    week: 'ww',
    weekDay: 'E',
    day: 'D',
    dayZZ: 'DD',
    time: 'HH:mm:ss',
    HHmm: 'HH:mm',
    stamp: 'X',
    ms: 'x',
    log: 'HH:mm:ss.SSS',
    elapse: 'mm:ss.SSS' // useful for reporting duration
};
var MON = 1, SUN = 7;
var hhmm = /^\d\d:\d\d$/; // a regex to match HH:MM
var divideBy = {
    years: 31536000000,
    months: 2628000000,
    weeks: 604800000,
    days: 86400000,
    hours: 3600000,
    minutes: 60000,
    seconds: 1000
};
//var weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
//var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
/** translate the supplied parameter into a Date */
var checkDate = function (dt) {
    if (isUndefined(dt))
        return new Date(); // curent datetime
    if (isDate(dt))
        return dt; // Date
    if (isString(dt))
        return new Date(dt); // parse date-string
    return new Date(dt * 1000); // timestamp
};
/** mutate a Date */
var setDate = function (mutate, unit, date, offset) {
    var _a;
    if (mutate !== 'add')
        _a = [0, 0, 0], date.HH = _a[0], date.MM = _a[1], date.SS = _a[2]; // discard the time-portion of the date
    switch (mutate + '.' + unit) {
        case 'start.week':
            date.dd = date.dd - date.ww + MON;
            break;
        case 'start.month':
            date.dd = 1;
            break;
        case 'end.week':
            date.dd = date.dd - date.ww + SUN;
            break;
        case 'end.month':
            date.mm += 1;
            date.dd = 0;
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
            date.MM += offset;
            break;
    }
    return getDate(new Date(date.yy, date.mm - 1, date.dd, date.HH, date.MM, date.SS));
};
/** break a Date into components, plus methods to manipulate */
getDate = function (dt) {
    var date = parseDate(dt);
    return __assign({}, date, { add: function (offset, unit) {
            if (unit === void 0) { unit = 'minutes'; }
            return setDate('add', unit, date, offset);
        }, startOf: function (unit) {
            if (unit === void 0) { unit = 'week'; }
            return setDate('start', unit, date);
        }, endOf: function (unit) {
            if (unit === void 0) { unit = 'week'; }
            return setDate('end', unit, date);
        }, diff: function (unit, dt2) {
            if (unit === void 0) { unit = 'years'; }
            return diffDate(date, parseDate(dt2), unit);
        }, format: function (fmt) { return formatDate(fmt, date); } });
};
/** break a Date into components, plus methods to manipulate */
var parseDate = function (dt) {
    if (isString(dt) && hhmm.test(dt)) // if only HH:MM supplied...
        dt = new Date().toDateString() + ' ' + dt; // current date, append time
    var date = checkDate(dt);
    var _a = [
        date.getFullYear(), date.getMonth(), date.getDate(), date.getDay(),
        date.getHours(), date.getMinutes(), date.getSeconds(), Math.round(date.getTime() / 1000),
        weekdays[date.getDay()], months[date.getMonth()],
    ], yy = _a[0], mm = _a[1], dd = _a[2], ww = _a[3], HH = _a[4], MM = _a[5], SS = _a[6], ts = _a[7], wn = _a[8], mn = _a[9];
    if (!ww)
        ww = 7; // ISO weekday
    mm += 1; // ISO month
    return { yy: yy, mm: mm, dd: dd, ww: ww, HH: HH, MM: MM, SS: SS, ts: ts, wn: wn, mn: mn };
};
/** apply some standard format rules */
var formatDate = function (fmt, date) {
    switch (fmt) {
        case DATE_FMT.HHmm:
            return fix(date.HH) + ":" + fix(date.MM);
        case DATE_FMT.yearMonthDay:
            return "" + date.yy + fix(date.mm) + fix(date.dd);
        case DATE_FMT.weekDay:
            return date.ww;
        case DATE_FMT.stamp:
            return date.ts;
        case DATE_FMT.display:
            return date.wn + ", " + fix(date.dd) + " " + date.mn + " " + date.yy;
        default:
            return '';
    }
};
/** calculate the difference between dates */
var diffDate = function (dt1, dt2, unit) {
    return Math.floor((dt2.ts - dt1.ts) / divideBy[unit]);
};
/** shortcut to getDate().format(stamp) */
getStamp = function (dt) {
    return getDate(dt).format(DATE_FMT.stamp);
}; // Unix timestamp-format
