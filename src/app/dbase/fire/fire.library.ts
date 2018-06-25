import { WhereFilterOp, Query } from '@firebase/firestore-types';
import { IQuery, IWhere, IOrderBy } from '@dbase/fire/fire.interface';
import { IStoreDoc } from '@state/store.define';

import { isObject, cloneObj, asArray, isString, isUndefined } from '@lib/object.library';
import { isNumeric } from '@lib/string.library';

/** Collection reference, with any limit / order criteria */
export const fnQuery = (query: IQuery = {}) => {
	return (colRef: Query) => {										// return a Query-function
		if (query.where) {
			let where: IWhere[] = isObject(query.where)
				? [query.where as IWhere]								// coerce into Array
				: query.where as IWhere[]
			where.forEach(qry => colRef = colRef.where(qry.fieldPath, qry.opStr as WhereFilterOp, qry.value));
		}

		if (query.orderBy) {
			let orderBy: IOrderBy[] = isObject(query.orderBy)
				? [query.orderBy as IOrderBy]
				: query.orderBy as IOrderBy[]
			orderBy.forEach(order => colRef = colRef.orderBy(order.fieldPath, order.directionStr));
		}

		if (isNumeric(query.limitTo))
			colRef = colRef.limit(query.limitTo as number);

		return colRef;
	}
}

/** filter an Array to meet the supplied conditions, logically ANDed */
export const filterArray = (table: IStoreDoc[] = [], cond: IWhere | IWhere[] = []) => {
	let lookup = cloneObj(table);														// clone the table argument, so we dont mutate it

	asArray(cond)																						// cast cond as an array
		.forEach(clause => lookup = lookup.filter((row: any) => {
			const key = row[clause.fieldPath as string];
			const field = isString(key) ? key.toLowerCase() : key;
			const value = isString(clause.value) ? clause.value.toLowerCase() : clause.value;

			switch (clause.opStr) {															// standard firestore query-operators, and '!='
				case '==':
					return field == value;													// use '==' to allow for string/number match, instead of '==='
				case '>':
					return field > value;
				case '>=':
					return field >= value;
				case '<':
					return field < value;
				case '<=':
					return field <= value;
				case '!=':																				// non-standard operator
					return isUndefined(field) || field != value;
				default:
					return false;
			}
		}))

	return lookup;
}