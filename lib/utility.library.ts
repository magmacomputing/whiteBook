/** General utility functions */

export type TPromiseStatus = 'pending' | 'fulfilled' | 'rejected';
export interface IPromise<T> {
	promise: Promise<T>;
	status: TPromiseStatus;
	resolve: (value?: T | PromiseLike<T> | undefined) => void;
	reject: (reason?: any) => void;
}

/** store a Promise and its callbacks, for later fulfilment */
export const setPromise = <T>() => {
	const obj: Partial<IPromise<T>> = {};						// create the placeholder for the Promise object

	obj.promise = new Promise<T>((resolve, reject) => {
		obj.status = 'pending';
		obj.resolve = val => {												// stash resolve()
			obj.status = 'fulfilled';										// mark the Promise as resolved
			resolve(val);
		}
		obj.reject = err => {													// stash reject()
			obj.status = 'rejected';										// mark the Promise as rejected
			reject(err);
		}
	});

	return obj as IPromise<T>;											// remove the 'Partial' type
}
