import { STORE, REACT } from '@dbase/data/data.define';
import { TString } from '@library/type.library';
import { TDate } from '@library/instant.library';

export interface IForumArgs {
	key: string,
	store?: STORE.react | STORE.comment;
	type?: STORE,
	track?: Record<string, string | number>;
	date?: TDate;
	uid?: string;
}

export interface ICommentArgs extends IForumArgs {
	comment?: TString;
}

export interface IReactArgs extends IForumArgs {
	react?: REACT;
}