/** General utility functions */

export type IResolve<T> = (value?: T | PromiseLike<T> | undefined) => void;
export type IReject = (reason?: any) => void;

export enum TPromiseStatus { pending, fulfilled, rejected };
export interface IPromise<T> {
	promise: Promise<T>;														// a Promise() object
	status: TPromiseStatus;													// the Promise status
	resolve: IResolve<T>;														// the Promise resolve() function
	reject: IReject;																// the Promise reject() function
}

/** Promise status */
export enum TPledge {
	'pending' = 'pending',
	'fulfilled' = 'fulfilled',
	'rejected' = 'rejected',
}
/** store a Promise, its status and its callbacks, for later fulfilment */
export class Pledge<T> {
	#tag: any;
	#status: TPledge;
	#promise: Promise<T>;														// TODO: is this needed?
	#resolve!: (value?: T | PromiseLike<T>) => void;
	#reject!: (reason?: any) => void;

	constructor(tag?: any) {
		this.#tag = tag;
		this.#status = TPledge.pending;

		this.#promise = new Promise<T>((resolve, reject) => {
			this.#resolve = resolve;
			this.#reject = reject;
		})
	}

	resolve(value?: any) {
		this.#resolve(value);
		this.#status = TPledge.fulfilled;
	}

	reject(error?: any) {
		this.#reject(error);
		this.#status = TPledge.rejected;
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
// export const setPromise = <T>() => {
// 	const obj: Partial<IPromise<T>> = {};						// create the placeholder for the Promise object

// 	obj.promise = new Promise<T>((resolve, reject) => {
// 		obj.status = TPromiseStatus.pending;					// init the Promise as unsettled

// 		obj.resolve = val => {												// stash resolve()
// 			obj.status = TPromiseStatus.fulfilled;			// mark the Promise as resolved
// 			resolve(val);
// 		}

// 		obj.reject = err => {													// stash reject()
// 			obj.status = TPromiseStatus.rejected;				// mark the Promise as rejected
// 			reject(err);
// 		}
// 	});

// 	return obj as IPromise<T>;											// remove the 'Partial' type
// }

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