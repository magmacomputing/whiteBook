import { STORE, REACT } from '@dbase/data/data.define';
import { TString } from '@lib/type.library';
import { TDate } from '@lib/instant.library';

export interface IForumArgs {
	key: string,
	store?: STORE.react | STORE.comment;
	type?: STORE,
	track?: { [key: string]: string | number };
	date?: TDate;
	uid?: string;
}

export interface ICommentArgs extends IForumArgs {
	comment?: TString;
}

export interface IReactArgs extends IForumArgs {
	react?: REACT;
}