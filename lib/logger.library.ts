import { isString } from '@lib/type.library';
import { sprintf } from '@lib/string.library';

/** setup a reference for debug(), bind the current component name */
export const dbg = (self: any) =>
	lprintf.bind(self, self.constructor.name);

/** console.log() formatter */
export const lprintf = (name: string = '', fmt?: any, ...msg: any[]) => {
	const isStr = isString(fmt);
	const sep = isStr && (fmt.includes(':') || msg.length === 0)
		? '.'
		: ': '
	let out: keyof Console = 'log';

	if (isStr) {
		const match = fmt.match(/(\w*)/i) || [];
		const word = match[1];
		if (['log', 'info', 'debug', 'warn', 'error'].includes(word)) {
			out = word as keyof Console;
			fmt = fmt.substring(word.length + 1).trim();
		}
	}

	console[out](sprintf(`${name}${sep}${fmt}`, ...msg));
}
