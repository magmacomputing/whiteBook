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

/** store a Promise, its status and its callbacks, for later fulfilment */
export const setPromise = <T>() => {
	const obj: Partial<IPromise<T>> = {};						// create the placeholder for the Promise object

	obj.promise = new Promise<T>((resolve, reject) => {
		obj.status = TPromiseStatus.pending;					// init the Promise as unsettled

		obj.resolve = val => {												// stash resolve()
			obj.status = TPromiseStatus.fulfilled;			// mark the Promise as resolved
			resolve(val);
		}

		obj.reject = err => {													// stash reject()
			obj.status = TPromiseStatus.rejected;				// mark the Promise as rejected
			reject(err);
		}
	});

	return obj as IPromise<T>;											// remove the 'Partial' type
}
