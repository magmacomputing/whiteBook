import { TStateSlice } from '@dbase/state/state.define';
import { IStoreMeta, TStoreMeta } from '@dbase/data/data.schema';
import { FIELD } from '@dbase/data/data.define';

/** Actions */
export namespace Client {
	export class Set {									// Add a Client object into the Store
		static readonly type = '[Sync Service] Set Client';
		constructor(public payload: TStoreMeta, public debug: boolean = true) { }
	}
	export class Del {									// Remove a Client object from the Store
		static readonly type = '[Sync Service] Delete Client';
		constructor(public payload: TStoreMeta, public debug: boolean = true) { }
	}
	export class Trunc {								// Truncate a Client object from the Store
		static readonly type = '[Sync Service] Truncate Client';
		constructor(public debug: boolean = true) { }
	}
}

export namespace Device {
	export class Set {										// Add a Client object-clone into the local Store
		static readonly type = '[Sync Service] Set Device';
		constructor(public payload: TStoreMeta, public debug: boolean = true) { }
	}
	export class Del {
		static readonly type = '[Sync Service] Delete Device';
		constructor(public payload: TStoreMeta, public debug: boolean = true) { }
	}
	export class Trunc {
		static readonly type = '[Sync Service] Truncate Device';
		constructor(public debug: boolean = true) { }
	}
}

export namespace Member {
	export class Set {									// Add a Member object into the Store
		static readonly type = '[Sync Service] Set Member';
		constructor(public payload: TStoreMeta, public debug: boolean = true) { }
	}
	export class Del {									// Remove a Member object from the Store
		static readonly type = '[Sync Service] Delete Member';
		constructor(public payload: TStoreMeta, public debug: boolean = true) { }
	}
	export class Trunc {								// Truncate a Member object from the Store
		static readonly type = '[Sync Service] Truncate Member';
		constructor(public debug: boolean = true) { }
	}
}

export namespace Attend {
	export class Set {									// Add Attend object into the Store
		static readonly type = '[Sync Service] Set Attend';
		constructor(public payload: TStoreMeta, public debug: boolean = true) { }
	}
	export class Del {									// Remove Attend object from the Store
		static readonly type = '[Sync Service] Delete Attend';
		constructor(public payload: TStoreMeta, public debug: boolean = true) { }
	}
	export class Trunc {								// Truncate Attend object from the Store
		static readonly type = '[Sync Service] Truncate Attend';
		constructor(public debug: boolean = true) { }
	}
	export class Sync {									// new Attend written
		static readonly type = 'Sync Service] Sync Attend';
		constructor(public payload: TStoreMeta) { }
	}
}

export namespace Admin {
	export class Set {										// Add Admin object into the Store
		static readonly type = '[Sync Service] Set Admin';
		constructor(public payload: TStoreMeta, public debug: boolean = true) { }
	}
	export class Del {										// Remove Admin object from the Store
		static readonly type = '[Sync Service] Delete Admin';
		constructor(public payload: TStoreMeta, public debug: boolean = true) { }
	}
	export class Trunc {									// Truncate Admin object from the Store
		static readonly type = '[Sync Service] Truncate Admin';
		constructor(public debug: boolean = true) { }
	}
}

// export namespace Forum {
// export class Set {
// 	static readonly type = '[Sync Service] Set Forum';
// 	constructor(public payload: TStoreMeta, public debug: boolean = true) { }
// }
// export class Det {
// 	static readonly type = '[Sync Service] Delete Forum';
// 	constructor(public payload: TStoreMeta, public debug: boolean = true) { }
// }
// export class Trunc {
// 	static readonly type = '[Sync Service] Truncate Forum';
// 	constructor(public debug: boolean = true) { }
// }
// }

/** helper function to return all except nominated document */
export const filterState = (state: TStateSlice<IStoreMeta>, payload: IStoreMeta, segment = FIELD.store) => {
	const slice = payload[segment];
	const curr = state && slice && state[slice] || [];

	return [...curr.filter(itm => itm[FIELD.id] !== payload[FIELD.id])];
}