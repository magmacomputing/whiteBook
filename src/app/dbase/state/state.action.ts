import { FIELD } from '@dbase/data.define';
import type { FireDocument } from '@dbase/data.schema';
import type { TStateSlice } from '@dbase/state/state.define';

/** Actions */
export namespace clientAction {
	export class Set {									// Add a Client object into the Store
		static readonly type = '[Sync Service] Set Client';
		constructor(public payload: FireDocument[], public debug: boolean = true) { }
	}
	export class Del {									// Remove a Client object from the Store
		static readonly type = '[Sync Service] Delete Client';
		constructor(public payload: FireDocument[], public debug: boolean = true) { }
	}
	export class Clear {								// Truncate a Client object from the Store
		static readonly type = '[Sync Service] Clear Client';
		constructor(public debug: boolean = true) { }
	}
}

export namespace memberAction {
	export class Set {									// Add a Member object into the Store
		static readonly type = '[Sync Service] Set Member';
		constructor(public payload: FireDocument[], public debug: boolean = true) { }
	}
	export class Del {									// Remove a Member object from the Store
		static readonly type = '[Sync Service] Delete Member';
		constructor(public payload: FireDocument[], public debug: boolean = true) { }
	}
	export class Clear {								// Truncate a Member object from the Store
		static readonly type = '[Sync Service] Clear Member';
		constructor(public debug: boolean = true) { }
	}
}

export namespace attendAction {
	export class Set {									// Add Attend object into the Store
		static readonly type = '[Sync Service] Set Attend';
		constructor(public payload: FireDocument[], public debug: boolean = true) { }
	}
	export class Del {									// Remove Attend object from the Store
		static readonly type = '[Sync Service] Delete Attend';
		constructor(public payload: FireDocument[], public debug: boolean = true) { }
	}
	export class Clear {								// Truncate Attend object from the Store
		static readonly type = '[Sync Service] Clear Attend';
		constructor(public debug: boolean = true) { }
	}
	export class Sync {									// new Attend written
		static readonly type = 'Sync Service] Sync Attend';
		constructor(public payload: FireDocument[]) { }
	}
}

export namespace adminAction {
	export class Set {										// Add Admin object into the Store
		static readonly type = '[Sync Service] Set Admin';
		constructor(public payload: FireDocument[], public debug: boolean = true) { }
	}
	export class Del {										// Remove Admin object from the Store
		static readonly type = '[Sync Service] Delete Admin';
		constructor(public payload: FireDocument[], public debug: boolean = true) { }
	}
	export class Clear {									// Truncate Admin object from the Store
		static readonly type = '[Sync Service] Clear Admin';
		constructor(public debug: boolean = true) { }
	}
}

/** helper function to return all except nominated document */
export const filterState = (state: TStateSlice<FireDocument>, payload: FireDocument, segment = FIELD.Store) => {
	const slice = payload[segment] as FIELD.Store | FIELD.Type;
	const curr = state && slice && state[slice] || [];

	return [...curr.filter(itm => itm[FIELD.Id] !== payload[FIELD.Id])];
}