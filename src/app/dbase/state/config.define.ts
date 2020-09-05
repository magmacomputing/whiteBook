import { COLLECTION, STORE } from '@dbase/data/data.define';
import { TString } from '@library/type.library';

/** These variables are built in ClientState snapshots */

// a map of STORE to the COLLECTION in which it belongs
export const SLICES: Partial<Record<COLLECTION, STORE[]>> = {};

// a list of Fields on which to filter Documents, when determining Type-2 delta-inserts
export const FILTER: Partial<Record<COLLECTION, TString>> = {}

// STORE sort criteria
export const SORTBY: Partial<Record<STORE, string[]>> = {};

// Comment parse criteria
interface Pattern {
  pat: string;                  // match pattern
  flag?: 'g';                   // optionally global
  repl: string;                 // replacement string
  sort: 0 | 1;                  // phase1 / phase2
}

export const COMMENT = {
  patterns: [] as Pattern[],   	// regular-expressesion to aid parsing Notes
  words: [] as string[],        // words that indicate Note should be reclassified as Comment
}