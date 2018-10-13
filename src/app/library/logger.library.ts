import { format } from 'util';
import { isString, isObject, isUndefined } from '@lib/type.library';

/** console.log() formatter */
export function dbg(fmt?: any, ...msg: any[]): void {
	// export const dbg = (fmt?: any, ...msg: any[]): void => {
	const name = this && this.constructor && this.constructor.name || '';
	const sep = isString(fmt) && (fmt.includes(':') || msg.length === 0)
		? '.' : ': ';

	log(name + sep + fmt, ...msg);// prepend the current Module name to aid debugging
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

/**
 * use sprintf-style formatting on a string.  
 * if the format does not contain a corresponding '%'-char, then de-construct the arguments
 */
export const sprintf = (fmt: any, ...msg: any[]): string => {
	if (isString(fmt) && !fmt.includes('%')) {
		msg.unshift(fmt);           // put the format into the msg array
		fmt = msg     							// and build a new format string
			.map(arg => isObject(arg) ? '%j' : '%s')
			.join(', ')								// reassemble as a comma-separated string
	}
	return format(fmt, ...msg);		// NodeJS.format()
}