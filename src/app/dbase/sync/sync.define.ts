import { Subscription } from 'rxjs';

import { FireQuery } from '@dbase/fire/fire.interface';
import { COLLECTION } from '@dbase/data/data.define';
import { ClientAction, MemberAction, AttendAction, AdminAction, DeviceAction } from '@dbase/state/state.action';

import { Pledge, TPledge } from '@library/utility.library';

export namespace Sync {

	export interface Key {
		collection: COLLECTION;
		query?: FireQuery;
	}

	export interface Status {
		collection: COLLECTION;
		query?: FireQuery;
		promise: TPledge;
	}

	export interface Listen {
		key: Sync.Key;												// the key to this listener
		label: string;												// Label to display for this listener
		cnt: number;													// count of snapshots received
		uid: string | null;										// authenticated User
		ready: Pledge<boolean>;								// indicate when snap0 is received
		subscribe: Subscription;							// used for turning off Subscription
		method: {
			setStore: typeof ClientAction.Set | typeof MemberAction.Set | typeof AttendAction.Set | typeof DeviceAction.Set | typeof AdminAction.Set;
			delStore: typeof ClientAction.Del | typeof MemberAction.Del | typeof AttendAction.Del | typeof DeviceAction.Del | typeof AdminAction.Del;
			truncStore: typeof ClientAction.Trunc | typeof MemberAction.Trunc | typeof AttendAction.Trunc | typeof DeviceAction.Trunc | typeof AdminAction.Trunc;
		}
	}

	export const storeStorage = '@@STATE';	// NGXS Store in localStorage
	export const adminStorage = '@@ADMIN';	// administrator settings
}