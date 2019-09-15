import { COLLECTION, STORE } from '@dbase/data/data.define';
import { TString } from '@lib/type.library';

/** These variables are built in ClientState initial snapshot */

// a map of STORE to the COLLECTION in which it belongs
export const SLICES: Partial<Record<COLLECTION, STORE[]>> = {};

// a list of Fields on which to Filter Documents, when determining Type-2 delta-inserts
export const FILTER: Partial<Record<COLLECTION, TString>> = {}

// STORE sort criteria
export const SORTBY: Partial<Record<STORE, TString>> = {};