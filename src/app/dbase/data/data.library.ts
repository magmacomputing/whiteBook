import { fire } from '@dbase/fire/fire.library';
import { FireService } from '@dbase/fire/fire.service';

import type { FireDocument } from '@dbase/data.schema';
import { FIELD } from '@dbase/data.define';
import { FILTER } from '@dbase/state/config.define';
import { getSlice } from '@dbase/state/state.library';

import { isObject, TString, isString } from '@library/type.library';
import { isEqual, getPath } from '@library/object.library';
import { asString } from '@library/string.library';
import { asArray } from '@library/array.library';

/** prepare a where-clause to use when identifying current documents that will clash with nextDoc */
export const getWhere = (nextDoc: FireDocument, filter: fire.Query["where"] = []) => {
	const where: fire.Where[] = [];
	const collection = getSlice(nextDoc[FIELD.Store]);
	const filters = FILTER[collection] || [];			// get the standard list of fields on which to filter

	asArray(filters).forEach(field => {
		if (nextDoc[field])                         // if that field exists in the doc, add it to the filter
			where.push(fire.addWhere(field, getPath(nextDoc, field)));
		else throw new Error(`missing required field: ${field}`)
	})

	asArray(filter).forEach(clause => {           // add any additional match-criteria
		if (getPath(nextDoc, clause.fieldPath as string))
			where.push(fire.addWhere(clause.fieldPath, clause.value, clause.opStr))
	})

	return where;
}

export const docPrep = <T>(doc: T, uid: string) => {
	const prep = doc as unknown as FireDocument;
	if (!prep[FIELD.Store])												// every document needs a <store> field
		throw new Error(`missing field "[${FIELD.Store}]" in ${doc}]`);

	const collection = getSlice(prep[FIELD.Store]);
	const filters = FILTER[collection] || [];

	if (filters.includes(FIELD.Uid) && !prep[FIELD.Uid])
		prep[FIELD.Uid] = uid;												// push the current user's uid on the document

	return prep as unknown as T;
}

/** Expire current docs */
export const updPrep = async <T extends FireDocument>(currDocs: T[], tstamp: number, fire: FireService) => {
	let stamp = tstamp;                           // stash the tstamp
	const updates = await Promise.all(
		currDocs.map(async currDoc => {             // loop through existing-docs first, to determine currEffect/currExpire range
			const currStore = currDoc[FIELD.Store];
			const currUpdate = { [FIELD.Id]: currDoc[FIELD.Id], [FIELD.Store]: currStore } as FireDocument;
			const currExpire = currDoc[FIELD.Expire];
			const currEffect = currDoc[FIELD.Effect]
				|| await fire.callMeta(currStore, currDoc[FIELD.Id]).then(meta => meta[FIELD.Create])
				|| Number.MIN_SAFE_INTEGER

			switch (true) {
				case tstamp === currEffect:             // anomaly; do nothing?
					break;

				case tstamp > currEffect:               // expire current Doc
					if (currExpire)                       // very rare
						stamp = -currExpire;                // adjust new Doc's expiry
					currUpdate[FIELD.Expire] = tstamp;
					break;

				case tstamp < currEffect:               // back-date a Document
					currUpdate[FIELD.Effect] = currEffect;// ensure current Doc is effective
					stamp = -currEffect;                  // adjust new Doc's expiry
					break;
			}

			return currUpdate as T;
		})
	)

	return { updates, stamp, data: currDocs };    // include the stamp, in case it was changed
}

/**
 * Discard the nextDoc if it is the same as at-least one of the currDocs  
 * In other words, dont Create needlessly.
 * @param discards: string[]      array of field-names to use in the compare
 * @param nextDoc:  IStoreMeta    document about to be Created
 * @param currDocs: IStoreMeta[]  array of documents to compare to the Create document
 * @returns boolean:							true indicates at least one currDoc matches nextDoc, so no Insert needed
 */
export const checkDiscard = (discards: TString, nextDoc: FireDocument, currDocs: FireDocument[]) => {
	console.log('discard.discards: ', discards);
	console.log('discard.nextDoc: ', nextDoc);
	console.log('discard.currDocs: ', currDocs);
	const discardFields = asArray(discards);				// list of fields to use in comparison
	if (discardFields.length === 0)
		return true;																	// nothing to compare

	const isMatch = currDocs
		.map(currDoc => 															// for each current document
			discardFields																// against each of the field-names to match...
				.map(field => {
					const val1 = nextDoc[field];
					const val2 = currDoc[field];
					const url1 = isString(val1) && (val1.startsWith('http://') || val1.startsWith('https://'));
					const url2 = isString(val2) && (val2.startsWith('http://') || val2.startsWith('https://'));
					const fld1 = url1 ? new URL(val1).pathname : val1;
					const fld2 = url2 ? new URL(val2).pathname : val2;

					const bool = isObject(fld1)
						? isEqual(fld1, fld2)									// compare field-by-field
						: asString(fld1) == asString(fld2)		// compare string-value
					if (!bool) {
						console.log('change ', field, 'from : ', currDoc[field]);
						console.log('change ', field, 'into : ', nextDoc[field]);
					}
					return bool;														// <true> if fields are equal
				})
				.every(bool => bool === true)							// is a match if *all* fields are equal
		)

	return isMatch.includes(true)                 	// at least one currDoc matches every field
}