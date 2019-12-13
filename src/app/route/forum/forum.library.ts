import { COMMENT } from '@library/config.define';

import { TString } from '@lib/type.library';
import { asArray } from '@lib/array.library';

/**
 * Remove unnecessary text-strings from Note field.  
 * Attempt to extract Comments from Note field.  
 * (this is primarily used when migrating from Google Sheets to Cloud Firestore)
 */
export const cleanNote = (note?: TString) => {
	let comment: string[] = [];
	let result: TString | undefined;
	let clean: TString | undefined = undefined;

	if (note) {
		clean = asArray(note)
			.map(note => {														// first, clean the Note of noise-words
				COMMENT.patterns
					.filter(row => row.sort === 0)
					.forEach(obj => note = note.replace(new RegExp(obj.pat, obj.flag), obj.repl))
				return note;
			})
			.map(note => {
				COMMENT.words.forEach(word => {					// look for trigger-words, or emoji
					if (note.toLowerCase().includes(word.toLowerCase()) || /[^\u0000-\u00ff]/.test(note)) {
						comment.push(note);									// move Note text to Comment
						note = '\n';												// discard Note
					}
				})
				return note;
			})
			.map(note => {														// final tidy-up on parsed Note
				COMMENT.patterns
					.filter(row => row.sort === 1)
					.forEach(obj => note = note.replace(new RegExp(obj.pat, obj.flag), obj.repl))
				return note.trim();
			})

		if (clean.length === 1)
			clean = clean[0];
		if (clean.length === 0)
			clean = undefined;												// unused note
	}

	if (comment.length > 1)
		result = comment;														// Comment string[]
	if (comment.length === 1)
		result = comment[0];												// Comment string
	if (comment.length < 1)
		result = undefined;													// Comment undefined

	return { note: clean, comment: result };
}
