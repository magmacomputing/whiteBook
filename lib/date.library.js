const fix = (nbr, max = 2, fill = '0') => nbr.toString().padStart(max, fill);
const asString = (str = '') => isString(str) ? str : (str.toString ? str.toString() : JSON.stringify(str));
const getType = (obj) => {
	const type = Object.prototype.toString.call(obj).slice(8, -1);

	return type === 'Object'
		? obj.constructor.name											// return Class name
		: type === 'Function' && obj.valueOf().toString().startsWith('class ')
			? 'Class'
			: type
}
const isType = (obj, type = 'Object') => getType(obj).toLowerCase() === type.toLowerCase();
const isString = (obj) => isType(obj, 'String');
const isNumber = (obj) => isType(obj, 'Number');
var DATE_FMT;
(function (DATE_FMT) {
    DATE_FMT["display"] = "ddd, dd mmm yyyy";
    DATE_FMT["dateTime"] = "yyyy-mm-dd HH:MI";
    DATE_FMT["dayMonth"] = "dd-mmm";
    DATE_FMT["HHMI"] = "HH:MI";
    DATE_FMT["yearWeek"] = "yyyyww";
    DATE_FMT["yearMonth"] = "yyyymm";
    DATE_FMT["yearMonthDay"] = "yyyymmdd";
})(DATE_FMT || (DATE_FMT = {}));
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// shortcut functions to common Instant class properties / methods.
/** get new Instant */  const getDate = (dt) => new Instant(dt);
/** get Timestamp */  const getStamp = (dt) => getDate(dt).ts;
/** format Instant */  const fmtDate = (fmt, dt) => getDate(dt).format(fmt);
 class Instant {
    constructor(dt, fmt) {
        // Public methods	~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        /** apply formatting*/ this.format = (fmt) => this.formatDate(fmt);
        /** calc diff Dates */ this.diff = (unit = 'years', dt2) => this.diffDate(unit, dt2);
        /** add date offset */ this.add = (offset, unit = 'minutes') => this.setDate('add', unit, offset);
        /** start offset */ this.startOf = (unit = 'week') => this.setDate('start', unit);
        /** middle offset */ this.midOf = (unit = 'week') => this.setDate('mid', unit);
        /** ending offset */ this.endOf = (unit = 'week') => this.setDate('end', unit);
        /** valid Instant */ this.isValid = () => !isNaN(this.date.ts);
        /** get raw object */ this.toObject = () => ({ ...this.date });
        /** as Date object */ this.asDate = () => new Date(this.date.ts * 1000 + this.date.ms);
        // Private methods	~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        /** parse a Date, return components */
        this.parseDate = (dt, fmt) => {
            let date;
            if (isString(dt) && Instant.hhmi.test(dt)) // if only HH:MI supplied...
                dt = `${new Date().toDateString()} ${dt}`; // 	prepend current date
            if ((isString(dt) || isNumber(dt)) && Instant.yyyymmdd.test(asString(dt))) // if yyyymmdd supplied as string...
                dt = asString(dt).replace(Instant.yyyymmdd, '$1-$2-$3 00:00:00'); // format to look like a date-string
            switch (getType(dt)) { // translate supplied parameter into a Date
                case 'Undefined': // set to 'now'
                    date = new Date();
                    break;
                case 'Date': // already is a valid Date
                    date = dt;
                    break;
                case 'Instant': // already have a valid Date
                    date = new Date(dt.ts * 1000 + dt.ms);
                    break;
                case 'String': // TODO: use fmt to parse date-string
                    date = new Date(dt); // attempt to parse date-string
                    break;
                case 'Number': // check whether milliseconds or microseconds
                    const nbr = dt;
                    const val = (nbr < Instant.maxStamp ? nbr * 1000 : nbr); // assume timestamp to milliseconds
                    date = new Date(val);
                    break;
                default: // unexpected input
                    date = new Date();
            }
            if (isNaN(date.getTime())) // Date not parse-able,
                console.log('Invalid Date: ', dt, date); // log the Invalid Date
            let [yy, mm, dd, HH, MI, SS, ms, ts, dow] = [
                date.getFullYear(), date.getMonth(), date.getDate(),
                date.getHours(), date.getMinutes(), date.getSeconds(),
                date.getMilliseconds(), Math.floor(date.getTime() / 1000), date.getDay(),
            ];
            mm += 1; // ISO month
            if (!dow && !isNaN(dow))
                dow = Instant.DAY.Sun; // ISO weekday
            const thu = date.setDate(dd - dow + Instant.DAY.Thu) / 1000; // set to nearest Thursday
            const ny = new Date(date.getFullYear(), 0, 1).valueOf() / 1000; // NewYears Day
            const ww = Math.floor((thu - ny) / Instant.divideBy.weeks + 1); // ISO Week Number
            return { yy, mm, dd, HH, MI, SS, ms, ts, ww, dow, mmm: Instant.MONTH[mm], ddd: Instant.DAY[dow] };
        };
        /** mutate an Instant */
        this.setDate = (mutate, unit, offset = 1) => {
            const date = { ...this.date }; // clone the current Instant
            if (mutate !== 'add')
                [date.HH, date.MI, date.SS, date.ms] = [0, 0, 0, 0]; // discard the time-portion of the date
            switch (`${mutate}.${unit}`) {
                case 'start.day':
                    [date.HH, date.MI, date.SS, date.ms] = [0, 0, 0, 0];
                    break;
                case 'start.week':
                    date.dd -= date.dow + Instant.DAY.Mon;
                    break;
                case 'start.month':
                    date.dd = 1;
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
                case 'add.minutes':
                    date.MI += offset;
                    break;
                case 'add.hour':
                case 'add.hours':
                    date.HH += offset;
                    break;
                case 'add.day':
                case 'add.days':
                    date.dd += offset;
                    break;
                case 'add.month':
                case 'add.months':
                    date.mm += offset;
                    break;
            }
            return new Instant(new Date(date.yy, date.mm - 1, date.dd, date.HH, date.MI, date.SS, date.ms));
        };
        /** combine Instant components to apply some standard / free-format rules */
        this.formatDate = (fmt, code) => {
            const date = { ...this.date }; // clone current Instant
            let result;
            switch (fmt) {
                // case DATE_FMT.HHMI:
                // 	result = `${fix(date.HH)}:${fix(date.MI)}`;
                // 	break;
                // case DATE_FMT.display:
                // 	result = `${date.ddd}, ${fix(date.dd)} ${date.mmm} ${date.yy}`;
                // 	break;
                // case DATE_FMT.dayMonth:
                // 	result = `${fix(date.dd)}-${date.mmm}`;
                // 	break;
                // case DATE_FMT.dateTime:
                // 	result = `${date.yy}-${date.mmm}-${fix(date.dd)} ${fix(date.HH)}:${fix(date.MI)}`;
                // 	break;
                case DATE_FMT.yearWeek:
                    const offset = date.ww === 1 && date.mm === 12; // if late-Dec, add 1 to yyyy
                    result = parseInt(`${date.yy + Number(offset)}${fix(date.ww)}`);
                    break;
                case DATE_FMT.yearMonth:
                    result = parseInt(`${fix(date.yy)}${fix(date.mm)}`);
                    break;
                case DATE_FMT.yearMonthDay:
                    result = parseInt(`${date.yy}${fix(date.mm)}${fix(date.dd)}`, 10);
                    break;
                default:
                    result = fmt
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
                        .replace(/ms/g, asString(date.ms))
                        .replace(/ts/g, asString(date.ts))
                        .replace(/w{2}/g, asString(date.ww))
                        .replace(/dow/g, asString(date.dow));
                    break;
            }
            // @ts-ignore			TODO: set return-type according to IDateFmt[K] | string
            return result;
        };
        /** calculate the difference between dates */
        this.diffDate = (unit = 'years', dt2) => Math.floor((this.parseDate(dt2).ts - this.date.ts) / Instant.divideBy[unit]);
        this.date = this.parseDate(dt, fmt);
    }
    // Public getters	~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    /** 4-digit year */ get yy() { return this.date.yy; }
    /** month number */ get mm() { return this.date.mm; }
    /** day number */ get dd() { return this.date.dd; }
    /** 24-hour format */ get HH() { return this.date.HH; }
    /** minutes */ get MI() { return this.date.MI; }
    /** seconds */ get SS() { return this.date.SS; }
    /** milliseconds */ get ms() { return this.date.ms; }
    /** timestamp */ get ts() { return this.date.ts; }
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
        WEEKDAY[WEEKDAY["Wedddesday"] = 3] = "Wedddesday";
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
    Instant.maxStamp = new Date('9999-12-31').valueOf() / 1000;
    Instant.minStamp = new Date('1000-01-01').valueOf() / 1000;
    Instant.divideBy = {
        years: 31536000,
        months: 2628000,
        weeks: 604800,
        days: 86400,
        hours: 3600,
        minutes: 60,
        seconds: 1,
    };
})(Instant || (Instant = {}));
