import { format } from 'util';
import { isString, isObject } from '@lib/type.library';

/** setup a copy for debug(), bind the current component name */
export const dbg = (self: any) =>
	lprintf.bind(self, self.constructor.name);

/** console.log() formatter */
export const lprintf = (name: string = '', fmt?: any, ...msg: any[]): void => {
	const sep = isString(fmt) && (fmt.includes(':') || msg.length === 0)
		? '.' : ': ';

	log(`${name}${sep}${fmt}`, ...msg);	// prepend the current Module name to aid debugging
}

const log = (fmt?: any, ...msg: any[]) => {
	let out: keyof Console = 'log';

	if (isString(fmt)) {
		const match = fmt.match(/(\w*):/i) || [];
		if (['log', 'info', 'debug', 'warn', 'error'].includes(match[1]))
			out = match[1] as keyof Console;
	}

	console[out](sprintf(fmt, ...msg));
}

/**
 * use sprintf-style formatting on a string.  
 * if the format does not contain a corresponding '%'-char, then de-construct the arguments
 */
export const sprintf = (fmt: any, ...msg: any[]) => {
	if (isString(fmt) && !fmt.includes('%')) {
		msg.unshift(fmt);						// put the format into the msg array
		fmt = msg     							// and build a new format string
			.map(arg => isObject(arg) ? '%j' : '%s')
			.join(', ')								// re-assemble as a comma-separated string
	}

	return format(fmt, ...msg);		// NodeJS.format()
}