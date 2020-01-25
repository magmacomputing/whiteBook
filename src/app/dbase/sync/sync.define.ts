import { Subscription } from 'rxjs';

import { COLLECTION } from '@dbase/data/data.define';
import { IQuery } from '@dbase/fire/fire.interface';

import { SetDevice, DelDevice, TruncDevice } from '@dbase/state/state.action';
import { SetClient, DelClient, TruncClient } from '@dbase/state/state.action';
import { SetMember, DelMember, TruncMember } from '@dbase/state/state.action';
import { SetAttend, DelAttend, TruncAttend } from '@dbase/state/state.action';
import { SetAdmin, DelAdmin, TruncAdmin } from '@dbase/state/state.action';

import { IPromise } from '@lib/utility.library';

export interface IListenKey {
	collection: COLLECTION;
	query?: IQuery;
}

export interface IListen {
	key: IListenKey;											// the key to this listener
	cnt: number;													// count of snapshots received
	uid: string | null;										// authenticated User
	ready: IPromise<boolean>;							// indicate when snap0 is received
	subscribe: Subscription;							// used for turning off Subscription
	method: {
		setStore: typeof SetClient | typeof SetMember | typeof SetAttend | typeof SetDevice | typeof SetAdmin;
		delStore: typeof DelClient | typeof DelMember | typeof DelAttend | typeof DelDevice | typeof DelAdmin;
		truncStore: typeof TruncClient | typeof TruncMember | typeof TruncAttend | typeof TruncDevice | typeof TruncAdmin;
	}
}

export const StoreStorage = '@@STATE';	// NGXS Store in localStorage
export const AdminStorage = '@@ADMIN';	// Administrator settings
