import { Subscription } from 'rxjs';

import type { Fire } from '@dbase/fire/fire.library';
import type { COLLECTION } from '@dbase/data.define';
import type { clientAction, memberAction, attendAction, adminAction } from '@dbase/state/state.action';

import type { Pledge } from '@library/utility.library';

export namespace sync {

	export interface Key {
		collection: COLLECTION;
		query?: Fire.Query;
	}

	export interface Status {
		collection: COLLECTION;
		query?: Fire.Query;
		promise: Pledge.Status;
	}

	export enum CHANGE {
		Added = 'added',
		Modified = 'modified',
		Removed = 'removed',
	}

	export enum SOURCE {
		Cache = 'cache',
		Local = 'local',
		Server = 'server',
	}

	export interface Listen {
		key: sync.Key;												// the key to this listener
		label: string;												// Label to display for this listener
		cnt: number;													// count of snapshots received
		uid: string | null;										// authenticated User
		ready: Pledge<boolean>;								// indicate when snap0 is received
		subscription: Subscription;
		method: {
			setStore: typeof clientAction.Set | typeof memberAction.Set | typeof attendAction.Set | typeof adminAction.Set;
			delStore: typeof clientAction.Del | typeof memberAction.Del | typeof attendAction.Del | typeof adminAction.Del;
			clearStore: typeof clientAction.Clear | typeof memberAction.Clear | typeof attendAction.Clear | typeof adminAction.Clear;
		}
	}
}