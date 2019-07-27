import { isString } from '@lib/type.library';
import { sprintf } from '@lib/string.library';

/** setup a reference for debug(), bind the current component name */
export const dbg = (self: any) =>
	lprintf.bind(self, self.constructor.name);

/** console.log() formatter */
export const lprintf = (name: string = '', fmt?: any, ...msg: any[]) => {
	const [type, log] = fprintf(fmt, ...msg);
	const sep = isString(fmt) && (fmt.includes(':') || msg.length === 0)
		? '.'
		: ': '

	console[type as keyof Console](`${name}${sep}${log}`);
}

/** break a fmt/msg into a 'Console.type' and 'message' */
export const fprintf = (fmt?: any, ...msg: any[]) => {
	let type = 'log';

	if (isString(fmt)) {
		const match = fmt.match(/(\w*)/i) || [];
		const part = match[1];
		if (['log', 'info', 'debug', 'warn', 'error'].includes(part)) {
			type = part;
			fmt = fmt.substring(type.length + 1).trim();
		}
	}

	const result = sprintf(fmt, ...msg);

	return [type, result];
}