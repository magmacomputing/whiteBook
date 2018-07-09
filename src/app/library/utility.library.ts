import { IPromise } from "./utility.interface";
import { isNumber, isString, isFunction } from "@lib/object.library";

/** General utility functions */

/** when we dont care about the catch() */
export const fnIgnore = (...arg: any[]) => { };

/** store a Promise and its callbacks, for later fulfilment */
export const createPromise = <T>() => {
	const obj: any = {};						// create the placeholder for the Promise object

	obj.promise = new Promise<T>((resolve, reject) => {
		obj.resolve = resolve;
		obj.reject = reject;
	});

	return obj as IPromise<T>;
}
