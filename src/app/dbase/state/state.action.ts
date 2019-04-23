import { IStoreMeta } from '@dbase/data/data.schema';

/** Actions */
export class SetClient {									// Add a Client object into the Store
	static type = '[Sync Service] Set Client';
	constructor(public payload: IStoreMeta, public debug: boolean = true) { }
}

export class DelClient {									// Remove a Client object from the Store
	static type = '[Sync Service] Delete Client';
	constructor(public payload: IStoreMeta, public debug: boolean = true) { }
}

export class TruncClient {								// Truncate a Client object from the Store
	static type = '[Sync Service] Truncate Client';
	constructor(public debug: boolean = true) { }
}

export class SetLocal {										// Add a Client object-clone into the local Store
	static type = '[Sync Service] Set Local';
	constructor(public payload: IStoreMeta, public debug: boolean = true) { }
}

export class DelLocal {
	static type = '[Sync Service] Delete Local';
	constructor(public payload: IStoreMeta, public debug: boolean = true) { }
}

export class TruncLocal {
	static type = '[Sync Service] Truncate Local';
	constructor(public debug: boolean = true) { }
}

export class SetMember {									// Add a Member object into the Store
	static type = '[Sync Service] Set Member';
	constructor(public payload: IStoreMeta, public debug: boolean = true) { }
}

export class DelMember {									// Remove a Member object from the Store
	static type = '[Sync Service] Delete Member';
	constructor(public payload: IStoreMeta, public debug: boolean = true) { }
}

export class TruncMember {								// Truncate a Member object from the Store
	static type = '[Sync Service] Truncate Member';
	constructor(public debug: boolean = true) { }
}

export class SetAttend {									// Add Attend object into the Store
	static type = '[Sync Service] Set Attend';
	constructor(public payload: IStoreMeta, public debug: boolean = true) { }
}

export class DelAttend {									// Remove Attend object from the Store
	static type = '[Sync Service] Delete Attend';
	constructor(public payload: IStoreMeta, public debug: boolean = true) { }
}

export class TruncAttend {								// Truncate Attend object from the Store
	static type = '[Sync Service] Truncate Attend';
	constructor(public debug: boolean = true) { }
}

export class SyncAttend {									// new Attend written
	static type = 'Sync Service] Sync Attend';
	constructor(public payload: IStoreMeta) { }
}

export class SetAdmin {										// Add Admin object into the Store
	static type = '[Sync Service] Set Admin';
	constructor(public payload: IStoreMeta, public debug: boolean = true) { }
}

export class DelAdmin {										// Remove Admin object from the Store
	static type = '[Sync Service] Delete Admin';
	constructor(public payload: IStoreMeta, public debug: boolean = true) { }
}

export class TruncAdmin {									// Truncate Admin object from the Store
	static type = '[Sync Service] Truncate Admin';
	constructor(public debug: boolean = true) { }
}
