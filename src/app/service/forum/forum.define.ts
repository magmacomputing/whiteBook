import { STORE, REACT } from '@dbase/data.define';
import { TString } from '@library/type.library';
import { TInstant } from '@library/instant.library';

export interface ForumArgs {
	key: string,
	store?: STORE.react | STORE.comment;
	type?: STORE,
	track?: Record<string, string | number>;
	date?: TInstant;
	uid?: string;
}

export interface CommentArgs extends ForumArgs {
	comment?: TString;
}

export interface ReactArgs extends ForumArgs {
	react?: REACT;
}