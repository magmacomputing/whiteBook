/** General interfaces */

export interface IResolve<T> {
	(value?: T | PromiseLike<T> | undefined): void;
}
export interface IReject {
	(reason?: any): void;
}

export interface IPromise<T> {
	promise: Promise<T>;
	resolve: IResolve<T>;
	reject: IReject;
}
