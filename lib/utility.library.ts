
export interface IPromise<T> {
	promise: Promise<T>;
	resolve: (value?: T | PromiseLike<T> | undefined) => void;
	reject: (reason?: any) => void;
}

/** General utility functions */

/** store a Promise and its callbacks, for later fulfilment */
export const createPromise = <T>() => {
	const obj: any = {};						// create the placeholder for the Promise object

	obj.promise = new Promise<T>((resolve, reject) => {
		obj.resolve = resolve;
		obj.reject = reject;
	});

	return obj as IPromise<T>;
}
