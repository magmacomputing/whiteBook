import type { STORE, REACT } from '@dbase/data.define';
import type { TString } from '@library/type.library';
import type { Instant } from '@library/instant.library';

export interface ForumArgs {
	key: string,
	store?: STORE.React | STORE.Comment;
	type?: STORE,
	track?: Record<string, string | number>;
	date?: Instant.TYPE;
	uid?: string;
}

export interface CommentArgs extends ForumArgs {
	comment?: TString;
}

export interface ReactArgs extends ForumArgs {
	react?: REACT;
}