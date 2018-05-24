import { Subscription } from 'rxjs';

export interface IListen {
	slice: string;
	cnt: number;
	// hash: string;
	subscribe: Subscription;
};

export const StoreStorage = '@@STATE';
export const StoreHash = '@@HASH';
