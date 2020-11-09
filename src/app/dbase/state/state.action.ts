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
	export class Trunc {								// Truncate a Client object from the Store
		static readonly type = '[Sync Service] Truncate Client';
		constructor(public debug: boolean = true) { }
	}
}

export namespace deviceAction {
	export class Set {										// Add a Client object-clone into the local Store
		static readonly type = '[Sync Service] Set Device';
		constructor(public payload: FireDocument[], public debug: boolean = true) { }
	}
	export class Del {
		static readonly type = '[Sync Service] Delete Device';
		constructor(public payload: FireDocument[], public debug: boolean = true) { }
	}
	export class Trunc {
		static readonly type = '[Sync Service] Truncate Device';
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
	export class Trunc {								// Truncate a Member object from the Store
		static readonly type = '[Sync Service] Truncate Member';
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
	export class Trunc {								// Truncate Attend object from the Store
		static readonly type = '[Sync Service] Truncate Attend';
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
	export class Trunc {									// Truncate Admin object from the Store
		static readonly type = '[Sync Service] Truncate Admin';
		constructor(public debug: boolean = true) { }
	}
}

// export namespace ForumAction {
// export class Set {
// 	static readonly type = '[Sync Service] Set Forum';
// 	constructor(public payload: IStoreMeta[], public debug: boolean = true) { }
// }
// export class Det {
// 	static readonly type = '[Sync Service] Delete Forum';
// 	constructor(public payload: IStoreMeta[], public debug: boolean = true) { }
// }
// export class Trunc {
// 	static readonly type = '[Sync Service] Truncate Forum';
// 	constructor(public debug: boolean = true) { }
// }
// }

/** helper function to return all except nominated document */
export const filterState = (state: TStateSlice<FireDocument>, payload: FireDocument, segment = FIELD.store) => {
	const slice = payload[segment] as FIELD.store | FIELD.type;
	const curr = state && slice && state[slice] || [];

	return [...curr.filter(itm => itm[FIELD.id] !== payload[FIELD.id])];
}