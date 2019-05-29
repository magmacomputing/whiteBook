import { Subscription } from 'rxjs';
import { IPromise } from '@lib/utility.library';
import { COLLECTION } from '@dbase/data/data.define';
import { TruncAttend, TruncClient, TruncMember, DelMember, DelAttend, DelClient, SetClient, SetMember, SetAttend, SetDevice, DelDevice, TruncDevice } from '@dbase/state/state.action';

export interface IListen {
	collection: COLLECTION;								// Firestore collection
	cnt: number;													// count of snapshots received
	uid: string | null;										// authenticated User
	ready: IPromise<boolean>;							// indicate when snap0 is received
	subscribe: Subscription;							// used for turning off Subscription
	method: {
		setStore: typeof SetClient | typeof SetMember | typeof SetAttend | typeof SetDevice;
		delStore: typeof DelClient | typeof DelMember | typeof DelAttend | typeof DelDevice;
		truncStore: typeof TruncClient | typeof TruncMember | typeof TruncAttend | typeof TruncDevice;
	}
};

export const StoreStorage = '@@STATE';	// NGXS Store in localStorage
