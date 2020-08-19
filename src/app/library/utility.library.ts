/** General utility functions */

/** Pledge status */
export enum TPledge {
	'pending' = 'pending',
	'fulfilled' = 'fulfilled',
	'rejected' = 'rejected',
}
/**
 * store a Promise, its status and its callbacks, for later fulfilment  
 * new Pledge<T>(tag?: any)  
 * input:  tag, simply to label a Pledge
 */
export class Pledge<T> {
	#tag: any;
	#status: TPledge;
	#promise: Promise<T>;
	#resolve!: (value?: T | PromiseLike<T>) => void;
	#reject!: (reason?: any) => void;

	constructor(tag?: any) {
		this.#tag = tag;
		this.#status = TPledge.pending;

		this.#promise = new Promise<T>((resolve, reject) => {
			this.#resolve = resolve;										// stash resolve()
			this.#reject = reject;											// stash reject()
		})
	}

	resolve(value?: any) {
		this.#resolve(value);
		return this.#status = TPledge.fulfilled;
	}

	reject(error?: any) {
		this.#reject(error);
		return this.#status = TPledge.rejected;
	}

	get promise() {
		return this.#promise;
	}

	get status() {
		return this.#status;
	}

	get tag() {
		return this.#tag;
	}
}

/** memoize repeated lookups */
export const memoize = (fn: Function) => {
	const cache = new Map<string, any>();

	return (...args: any[]) => {
		const key = JSON.stringify(args) ?? 'undefined';

		if (!cache.has(key))
			cache.set(key, fn(...args));

		return cache.get(key);
	}
}

export const getCaller = () => {
	const stackTrace = (new Error()).stack											// Only tested in latest FF and Chrome
		?.split('\n')
		?.map(itm => itm.trim())
		?.filter(itm => !itm.startsWith('Error'))
		?? []

	// console.log('getCaller: ', stackTrace);
	const callerName = stackTrace[2].split(' ');

	// ?.replace(/^Error\s+/, '') // Sanitize Chrome
	// ?.split('\n')[2]
	// ?.split(' ')[3]


	// callerName = callerName?.split("\n")[1]; // 1st item is this, 2nd item is caller
	// callerName = callerName?.replace(/^\s+at Object./, ''); // Sanitize Chrome
	// callerName = callerName?.replace(/ \(.+\)$/, ''); // Sanitize Chrome
	// callerName = callerName?.replace(/\@.+/, ''); // Sanitize Firefox

	return (callerName[1] === 'new') ? callerName[2] : callerName[1].split('.')[0];
}