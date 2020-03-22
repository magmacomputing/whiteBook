import { FireService } from '@dbase/fire/fire.service';
import { TWhere } from '@dbase/fire/fire.interface';

import { FILTER } from '@library/config.define';
import { COLLECTION, STORE, FIELD } from '@dbase/data/data.define';
import { TStoreBase, IStoreMeta, FType, FNumber, IClientBase } from '@dbase/data/data.schema';
import { getSlice } from '@dbase/state/state.library';

import { isObject, TString } from '@lib/type.library';
import { equalObj, getPath } from '@lib/object.library';
import { asString } from '@lib/string.library';
import { asArray } from '@lib/array.library';
import { addWhere } from '@dbase/fire/fire.library';

// client documents have a '<key>' field, user documents have a '<uid>' field
export const isClientDocument = (document: TStoreBase): document is IClientBase =>
	getSlice(document[FIELD.store]).toString() === COLLECTION.client || getSlice(document[FIELD.store]).toString() === STORE.local;

/** prepare a where-clause to use when identifying current documents that will clash with nextDoc */
export const getWhere = (nextDoc: IStoreMeta, filter: TWhere = []) => {
	const where: TWhere = [];
	const collection = getSlice(nextDoc[FIELD.store]);
	const filters = FILTER[collection] || [];			// get the standard list of fields on which to filter

	asArray(filters).forEach(field => {
		if (nextDoc[field])                         // if that field exists in the doc, add it to the filter
			where.push(addWhere(field, getPath(nextDoc, field)));
		else throw new Error(`missing required field: ${field}`)
	})

	asArray(filter).forEach(clause => {           // add any additional match-criteria
		if (getPath(nextDoc, clause.fieldPath as string))
			where.push(addWhere(clause.fieldPath, clause.value, clause.opStr))
	})

	return where;
}

export const docPrep = (doc: TStoreBase, uid: string) => {
	if (!doc[FIELD.store])												// every document needs a <store> field
		throw new Error(`missing field "[${FIELD.store}]" in ${doc}]`);

	if (!isClientDocument(doc))										// if not a /client document
		if (!doc[FIELD.uid] && uid)									//  and the <uid> field is missing from the document
			doc[FIELD.uid] = uid;											//  push the current user's uid onto the document

	return doc;
}

/** Expire current docs */
export const updPrep = async (currDocs: TStoreBase[], tstamp: number, fire: FireService) => {
	let stamp = tstamp;                           // stash the tstamp
	const updates = await Promise.all(
		currDocs.map(async currDoc => {             // loop through existing-docs first, to determine currEffect/currExpire range
			const currStore = currDoc[FIELD.store];
			const currUpdate = { [FIELD.id]: currDoc[FIELD.id], [FIELD.store]: currStore } as TStoreBase;
			const currExpire = currDoc[FIELD.expire] as FType<FNumber>;
			const currEffect = currDoc[FIELD.effect] as FType<FNumber>
				|| await fire.callMeta(currStore, currDoc[FIELD.id]).then(meta => meta[FIELD.create])
				|| Number.MIN_SAFE_INTEGER

			switch (true) {
				case tstamp === currEffect:             // anomaly; do nothing?
					break;

				case tstamp > currEffect:               // expire current Doc
					if (currExpire)                       // very rare
						stamp = -currExpire;                // adjust new Doc's expiry
					currUpdate[FIELD.expire] = tstamp;
					break;

				case tstamp < currEffect:               // back-date a Document
					currUpdate[FIELD.effect] = currEffect;// ensure current Doc is effective
					stamp = -currEffect;                  // adjust new Doc's expiry
					break;
			}

			return currUpdate;
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
 */
export const checkDiscard = (discards: TString, nextDoc: IStoreMeta, currDocs: IStoreMeta[]) => {
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
					const bool = isObject(nextDoc[field])		// compare field-by-field
						? equalObj(nextDoc[field], currDoc[field])
						: asString(nextDoc[field]) == asString(currDoc[field])
					if (!bool)
						console.log('change ', field, ': ', currDoc[field], ' => ', nextDoc[field]);
					return bool;														// <true> if fields are equal
				})
				.every(bool => bool === true)							// is a match if *all* fields are equal
		)

	return isMatch.includes(true)                 // at least one currDoc matches every field
}