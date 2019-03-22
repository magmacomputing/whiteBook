import * as firebase from 'firebase/app';
import { Query, FieldPath, QueryFn } from '@angular/fire/firestore';
import { IQuery, IWhere } from '@dbase/fire/fire.interface';

import { asArray } from '@lib/array.library';
import { isNumeric } from '@lib/string.library';
import { isUndefined, isArray } from '@lib/type.library';

/** Array of Query Functions with any limit / order criteria.  
 * If a Where-clause contains an array of <value>, this indicates a logical-or,
 * and needs to be split into a separate Query
 */
export const fnQuery = (query: IQuery = {}) => {
	const fns: QueryFn[] = [];

	splitQuery(query).forEach(qry => {
		fns.push(
			(colRef: Query) => {															// push a Query-function
				if (query.where)
					asArray(query.where)
						.filter(qry => !isUndefined(qry.value))			// discard queries for 'undefined' value
						.forEach(qry => colRef = colRef.where(qry.fieldPath, (qry.opStr || '==') as firebase.firestore.WhereFilterOp, qry.value));

				if (query.orderBy)
					asArray(query.orderBy)
						.forEach(order => colRef = colRef.orderBy(order.fieldPath, order.directionStr));

				if (isNumeric(query.limitTo))
					colRef = colRef.limit(query.limitTo as number);

				return colRef;
			}
		)
	})

	return fns;
}

/** create a set of Where-clauses to split the logical-or criteria */
const splitQuery = (query: IQuery) => {
	const split: IQuery[] = [];
	const check: [number, number][] = [];

	if (query.where) {
		asArray(query.where).forEach((where, w) =>
			asArray(where.value).forEach((_value, v, arr) => {
				if (arr.length > 1)
					check.push([w, v])
			})
		)
	}
	return split.length ? split : [query];
}

/** Make a 'where' clause */
export const addWhere = (fieldPath: string | FieldPath, value: any, opStr: IWhere["opStr"] = '==') => {
	const where: IWhere = { fieldPath, value };
	if (opStr) where.opStr = opStr;
	return where;
}