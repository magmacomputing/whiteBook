import { FieldPath, QueryFn } from '@angular/fire/firestore';

import { FIELD } from '@dbase/data/data.define';

import { asArray } from '@library/array.library';
import { isNumeric } from '@library/string.library';
import { isUndefined, isArray } from '@library/type.library';

/** shortcuts to FireService static properties and types */
export namespace Fire {

	/**
	 * Array of Query functions with any limit / order criteria.  
	 * If a Where-clause contains an array of <values>, this indicates a logical-OR,
	 * and needs to be split into separate Queries, as Firestore does not currently
	 * allow 'or' in a complex Query
	 */
	export const fnQuery = (query: Fire.Query = {}) => {
		return splitQuery(query)
			.map<QueryFn>(split =>
				(colRef: firebase.default.firestore.Query) => {															// map a Query-function
					if (split.where)
						asArray(split.where)
							.filter(where => !isUndefined(where.value))	// discard queries for 'undefined' value; not supported
							.forEach(where => colRef = colRef.where(where.fieldPath, (where.opStr || isArray(where.value) ? 'in' : '=='), where.value));

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
	const splitQuery = (query: Fire.Query = {} as Fire.Query) => {
		const wheres = asArray(query.where)						// for each 'where' clause
			.map(where => {
				if (isArray(where.value)) {
					where.value = where.value.distinct();
					if (where.opStr === 'in' && where.value.length === 0)
						where.value = ['<null>'];
				}

				return where.opStr === 'in'
					? asArray(where)
					: asArray(where.value)									// for each 'value'
						.distinct()														// remove duplicates
						.map(value => Fire.addWhere(where.fieldPath, value, where.opStr))
			})
			.cartesian();																// cartesian product of IWhere array

		const split: Fire.Query[] = asArray(wheres)
			.map(where =>																// for each split IWhere,
			({																				// build an array of IQuery
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

	export const addWhere = (fieldPath: string | FieldPath, value: any, opStr?: Fire.Where["opStr"]): Fire.Where => {
		const operator = isArray(value) ? 'in' : '==';
		return { fieldPath, opStr: opStr ?? operator, value };
	}

	export const addOrder = (fieldPath: string | FieldPath, directionStr: Fire.OrderBy["directionStr"] = 'asc'): Fire.OrderBy =>
		({ fieldPath, directionStr });

	/** Query.where */
	export interface Where {
		fieldPath: string | firebase.default.firestore.FieldPath;
		opStr?: firebase.default.firestore.WhereFilterOp;
		value: any | any[];
	}

	/** Query.orderBy */
	export interface OrderBy {
		fieldPath: string | firebase.default.firestore.FieldPath;
		directionStr?: firebase.default.firestore.OrderByDirection;
	}

	/** Collection.Query */
	export interface Query {
		where?: Fire.Where | Fire.Where[];
		orderBy?: Fire.OrderBy | Fire.OrderBy[];
		limit?: number;
		startAt?: string;
		startAfter?: string;
		endAt?: string;
		endBefore?: string;
	}

	/** FirestoreFunction getMeta() */
	export interface DocMeta {
		[FIELD.id]: string;
		[FIELD.create]?: number;
		[FIELD.update]?: number;
		[FIELD.access]?: number;
		exists: boolean;
		path: string;
		parent: string;
		subcollections?: string[];
	}
}
