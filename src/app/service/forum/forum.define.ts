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

export const CLEAN = {
	gift1: /Gift #\d+,/,
	gift2: /, Gift #\d+/,
	gift3: /Gift #\d+/,
	and: /and #\d+/,
	week: /Bonus: Week Level reached/,
	week2: /Bonus: week level reached/,
	spaces: /  +/g,
	newline: /\n/g,
	newlines: /\n\s*\n/g,
	comma1: /^,/,
	comma2: /,$/,
	colon1: /^:/,
	colon2: /:$/,
}
export const COMMENTS = [
	'Great',
	'Hello',
	'Happy',
	'Jorge',
	'love',
	'good',
	'relax',
	"I'm",
	'I am',
	'Something',
	'Instructor',
	'routine',
	'Whateva',
	'holiday',
	'clever',
	'xxx',
	' 2017',
	'Lucie',
	"'",
	'"',
	',',
	'.',
	'!',
	'?',
	':',
	';'
];