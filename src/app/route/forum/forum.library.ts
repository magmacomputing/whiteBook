import { CLEAN, COMMENTS } from '@route/forum/forum.define';

import { TString } from '@lib/type.library';
import { asArray } from '@lib/array.library';

/**
 * Remove unnecessary text-strings from Note field.  
 * Attempt to extract Comments from Note field.
 */
export const cleanNote = (note?: TString) => {
	let comment: string[] = [];
	let result: TString | undefined;
	let clean: TString | undefined = undefined;

	if (note) {
		clean = asArray(note)
			.map(note => note.replace(CLEAN.gift1, '').replace(CLEAN.gift2, '').replace(CLEAN.gift3, '').replace(CLEAN.and, ''))
			.map(note => note.replace(CLEAN.week, '').replace(CLEAN.week2, ''))
			.map(note => {														// check Note for Comment-like words
				COMMENTS.forEach(word => {
					if (note.toUpperCase().includes(word.toUpperCase()) || /[^\u0000-\u00ff]/.test(note)) {
						comment.push(note);									// push Note into Comment
						note = `
						`;																	// override Note with <newline>
					}
				})
				return note;
			})
			.map(note => note.replace(CLEAN.newlines, '\n').replace(CLEAN.newline, ',').replace(CLEAN.spaces, ' ').trim())
			.map(note => note.replace(CLEAN.comma1, '').replace(CLEAN.comma2, '').replace(CLEAN.colon1, '').replace(CLEAN.colon2, '').trim())

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
