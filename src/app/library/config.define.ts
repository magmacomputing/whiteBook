import { COLLECTION, STORE, FIELD } from '@dbase/data/data.define';
import { TString } from '@lib/type.library';
import { IObject } from '@lib/object.library';

/** These variables are built in ClientState initial snapshot */
export let SLICES: IObject<STORE[]> = {};

/** a list of Fields on which to Filter Documents, when determining Type-2 delta-inserts */
export let FILTER: IObject<TString> = {
	[COLLECTION.client]: [FIELD.store, FIELD.key],
	[COLLECTION.member]: [FIELD.store, FIELD.type, FIELD.uid],
	[COLLECTION.attend]: [FIELD.store, FIELD.type, FIELD.uid],
}

export let SORTBY: IObject<TString> = {};