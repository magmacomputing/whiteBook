import { Subscription } from 'rxjs';

import { COLLECTION } from '@dbase/data/data.define';
import { IQuery } from '@dbase/fire/fire.interface';
import { Client, Member, Attend, Admin, Device } from '@dbase/state/state.action';

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
		setStore: typeof Client.Set | typeof Member.Set | typeof Attend.Set | typeof Device.Set | typeof Admin.Set;
		delStore: typeof Client.Del | typeof Member.Del | typeof Attend.Del | typeof Device.Del | typeof Admin.Del;
		truncStore: typeof Client.Trunc | typeof Member.Trunc | typeof Attend.Trunc | typeof Device.Trunc | typeof Admin.Trunc;
	}
}

export const StoreStorage = '@@STATE';	// NGXS Store in localStorage
export const AdminStorage = '@@ADMIN';	// Administrator settings
