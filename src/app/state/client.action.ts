import { IClientDoc } from '@app/state/client.state';
import { FIELD } from '@app/dbase/fire/fire.define';

// Add a Client object into the Store
export class SetClient {
	static type = '[Sync Service] Set Client';
	constructor(public payload: IClientDoc) { };
}

// Remove a Client object from the Store
export class DelClient {
	static type = '[Sync Service] Delete Client';
	constructor(public payload: IClientDoc) { };
}

// Truncate a Client object from the Store
export class TruncClient {
	static type = '[Sync Service] Truncate Client';
	// constructor(public payload: string) { };
}