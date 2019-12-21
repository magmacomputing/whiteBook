
export interface IPromise<T> {
	promise: Promise<T>;
	status: boolean;
	resolve: (value?: T | PromiseLike<T> | undefined) => void;
	reject: (reason?: any) => void;
}

/** General utility functions */

/** store a Promise and its callbacks, for later fulfilment */
export const setPromise = <T>() => {
	const obj: Partial<IPromise<T>> = {};						// create the placeholder for the Promise object

	obj.promise = new Promise<T>((resolve, reject) => {
		obj.resolve = val => {
			obj.status = true;													// mark the Promise as resolved
			resolve(val);																// stash resolve()
		}
		obj.reject = err => {
			obj.status = false;													// mark the Promise as rejected
			reject(err);																// stash reject()
		}
	});

	return obj as IPromise<T>;
}
