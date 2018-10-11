import { Subscription } from 'rxjs';
import { IPromise } from '@lib/utility.library';

export interface IListen {
	slice: string;												// slice of ngxs/store
	cnt: number;													// count of snapshots received
	ready: IPromise<boolean>;							// indicate when snap0 is received
	subscribe: Subscription;							// used for turning off RX subscription
};

export const StoreStorage = '@@STATE';
