/** General utility functions */

/**
 * store a Promise<T>, its status and callbacks for later fulfilment  
 * new Pledge<T>(tag?: any)  
 * input:  tag, simply to label a Pledge
 */
export class Pledge<T> {
	#status: {
		tag: string | undefined;
		value: T | Error | undefined;
		state: Pledge.State;
	}
	#promise: Promise<T>;
	#resolve!: (value: T | PromiseLike<T>) => void;
	#reject!: (reason?: any) => void;

	constructor(tag?: string) {
		this.#status = {
			tag,
			value: undefined,
			state: Pledge.State.pending,
		}
		this.#promise = new Promise<T>((resolve, reject) => {
			this.#resolve = resolve;										// stash resolve()
			this.#reject = reject;											// stash reject()
		})
	}

	resolve(value: T) {
		if (this.#status.state === Pledge.State.pending) {
			Object.assign(this.#status, { state: Pledge.State.fulfilled, value });
			this.#resolve(value);
		}
		return value;
	}

	reject(error?: any) {
		if (this.#status.state === Pledge.State.pending) {
			Object.assign(this.#status, { state: Pledge.State.rejected, value: error });
			this.#reject(error);
		}
		return error;
	}

	get promise() {
		return this.#promise;
	}

	get status() {
		return this.#status;
	}
}

export namespace Pledge {
	export enum State {
		'pending' = 'pending',
		'fulfilled' = 'fulfilled',
		'rejected' = 'rejected',
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
