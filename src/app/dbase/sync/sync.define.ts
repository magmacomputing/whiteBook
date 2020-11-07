import { Subscription } from 'rxjs';

import type { fire } from '@dbase/fire/fire.library';
import type { COLLECTION } from '@dbase/data/data.define';
import type { clientAction, memberAction, attendAction, adminAction, deviceAction } from '@dbase/state/state.action';

import type { Pledge } from '@library/utility.library';

export namespace sync {

	export interface Key {
		collection: COLLECTION;
		query?: fire.Query;
	}

	export interface Status {
		collection: COLLECTION;
		query?: fire.Query;
		promise: Pledge.Status;
	}

	export interface Listen {
		key: sync.Key;												// the key to this listener
		label: string;												// Label to display for this listener
		cnt: number;													// count of snapshots received
		uid: string | null;										// authenticated User
		ready: Pledge<boolean>;								// indicate when snap0 is received
		subscribe: Subscription;							// used for turning off Subscription
		method: {
			setStore: typeof clientAction.Set | typeof memberAction.Set | typeof attendAction.Set | typeof deviceAction.Set | typeof adminAction.Set;
			delStore: typeof clientAction.Del | typeof memberAction.Del | typeof attendAction.Del | typeof deviceAction.Del | typeof adminAction.Del;
			truncStore: typeof clientAction.Trunc | typeof memberAction.Trunc | typeof attendAction.Trunc | typeof deviceAction.Trunc | typeof adminAction.Trunc;
		}
	}
}