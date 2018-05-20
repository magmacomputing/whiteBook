import { IClientSlice } from '@app/state/client.state';

// Add a Client object into the Store
export class SetClient {
	static type = '[Sync Service] Set Client';
	constructor(public payload: IClientSlice) { };
}

// Remove a Client object from the Store
export class DelClient {
	static type = '[Sync Service] Delete Client';
	constructor(public payload: IClientSlice) { };
}