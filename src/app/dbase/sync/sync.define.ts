import { Subscription } from 'rxjs';
import { IPromise } from '@lib/utility.interface';

export interface IListen {
	slice: string;												// slice of RX/store
	cnt: number;													// count of snapshots received
	ready: IPromise<boolean>;							// indicate when snap0 is received
	subscribe: Subscription;							// used for turning off RX subscription
};

export const StoreStorage = '@@STATE';
export const StoreHash = '@@HASH';
