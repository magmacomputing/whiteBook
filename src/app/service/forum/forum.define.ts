import { STORE, REACT } from '@dbase/data/data.define';
import { TString } from '@lib/type.library';
import { TDate } from '@lib/date.library';

export interface IForumArgs {
	key: string,
	type?: STORE,
	info?: { [key: string]: string | number };
	date?: TDate;
}

export interface ICommentArgs extends IForumArgs {
	comment: TString;
}

export interface IReactArgs extends IForumArgs {
	react: REACT;
}