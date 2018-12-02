import { Subscription } from 'rxjs';
import { IPromise } from '@lib/utility.library';
import { TruncAttend, TruncClient, TruncMember, DelMember, DelAttend, DelClient, SetClient, SetMember, SetAttend, SetLocal, DelLocal, TruncLocal } from '@dbase/state/state.action';

export interface IListen {
	slice: string;												// slice of ngxs/store
	cnt: number;													// count of snapshots received
	ready: IPromise<boolean>;							// indicate when snap0 is received
	subscribe: Subscription;							// used for turning off Subscription
	method: {
		setStore: typeof SetClient | typeof SetMember | typeof SetAttend | typeof SetLocal;
		delStore: typeof DelClient | typeof DelMember | typeof DelAttend | typeof DelLocal;
		truncStore: typeof TruncClient | typeof TruncMember | typeof TruncAttend | typeof TruncLocal;
	}
};

export const StoreStorage = '@@STATE';
