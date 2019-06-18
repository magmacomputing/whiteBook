import * as firebase from 'firebase/app';
import { Query, FieldPath, QueryFn } from '@angular/fire/firestore';
import { IQuery, IWhere } from '@dbase/fire/fire.interface';

import { asArray } from '@lib/array.library';
import { isNumeric } from '@lib/string.library';
import { isUndefined } from '@lib/type.library';

/**
 * Array of Query functions with any limit / order criteria.  
 * If a Where-clause contains an array of <values>, this indicates a logical-or,
 * and needs to be split into separate Queries, as Firestore does not currently
 * allow 'or' in a single Query
 */
export const fnQuery = (query: IQuery = {}) => {
	return splitQuery(query)
		.map<QueryFn>(split =>
			(colRef: Query) => {													// map a Query-function
				if (split.where)
					asArray(split.where)
						.filter(where => !isUndefined(where.value))	// discard queries for 'undefined' value, not supported
						.forEach(where => colRef = colRef.where(where.fieldPath, (where.opStr || '==') as firebase.firestore.WhereFilterOp, where.value));

				if (split.orderBy)
					asArray(split.orderBy)
						.forEach(order => colRef = colRef.orderBy(order.fieldPath, order.directionStr));

				if (isNumeric(split.limit))
					colRef = colRef.limit(split.limit);

				if (split.startAt)
					colRef = colRef.startAt(split.startAt);

				if (split.startAfter)
					colRef = colRef.startAfter(split.startAfter);

				if (split.endAt)
					colRef = colRef.endAt(split.endAt);

				if (split.endBefore)
					colRef = colRef.endBefore(split.endBefore);

				return colRef;
			}
		)
}

// TODO: consider split on fieldPath as well?
/**
 * create a set of Query-clauses to split the logical-or criteria.  
 * for example {fieldPath: 'uid', value: ['abc','def']} will return an array as
 * [ {fieldPath:'uid', value:'abc'}, {fieldPath:'uid', value'def'} ]  
 * This allows us to set separate Queries for each split clause
 */
const splitQuery = (query: IQuery = {}) => {
	const wheres = asArray(query.where)						// for each 'where' clause
		.map(where => asArray(where.value)					// for each 'value'
			.distinct()																// remove duplicates
			.map(value => addWhere(where.fieldPath, value, where.opStr))
		)
		.cartesian();																// cartesian product of IWhere array

	const split: IQuery[] = wheres.map(where =>		// for each split IWhere,
		({																					// build an array of IQuery
			orderBy: query.orderBy,
			limitTo: query.limit,
			startAt: query.startAt,
			startAfter: query.startAfter,
			endAt: query.endAt,
			endBefore: query.endBefore,
			where: where,
		})
	)

	return split.length ? split : asArray(query);	// if no IWhere[], return array of original Query
}

/** Make a 'where' clause */
export const addWhere = (fieldPath: string | FieldPath, value: any, opStr: IWhere["opStr"] = '==') =>
	({ fieldPath, opStr, value } as IWhere);