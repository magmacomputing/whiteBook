import { format } from 'util';
import { isString, isObject } from '@lib/object.library';

/**
 * console.log() formatter
 */
export function dbg(fmt?: any, ...msg: any[]): void {
	let name = this && this.constructor && this.constructor.name || '';
	let sep = isString(fmt) && (fmt.includes(':') || msg.length === 0)
		? '.' : ': ';

	log(name + sep + fmt, ...msg);
}

export const log = (fmt?: any, ...msg: any[]): void => {
	let out = 'log';
	if (isString(fmt)) {
		let match = fmt.match(/(\w*):/i) || [];
		if (['log', 'info', 'debug', 'warn', 'error'].includes(match[1]))
			out = match[1];
	}
	(console as any)[out](sprintf(fmt, ...msg));
}

// Temporary method definition until /log layout designed
export const logE = (fmt?: any, ...msg: any[]): void => {
	dbg(fmt, ...msg);
}

/**
 * attempt to use sprintf-style formatting on a string.
 * if the format does not contain a '%'-char, then de-construct the arguments
 */
export const sprintf = (fmt: any, ...msg: any[]): string => {
	if (isString(fmt) && !fmt.includes('%')) {
		msg.unshift(fmt);           // put the format into the msg array
		fmt = msg.map(arg => {      // and build a new format string
			return isObject(arg) ? '%j' : '%s'
		}).join(', ');
	}
	return format(fmt, ...msg);		// NodeJS.format()
}