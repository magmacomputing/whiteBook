import { Subscription } from 'rxjs';

export interface IListen {
	slice: string;
	cnt: number;
	subscribe: Subscription;
};

export const StoreStorage = '@@STATE';
export const StoreHash = '@@HASH';
