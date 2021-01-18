import { FieldPath, QueryFn } from '@angular/fire/firestore';

import { COLLECTION, FIELD } from '@dbase/data.define';

import { asArray } from '@library/array.library';
import { isNumeric } from '@library/string.library';
import { isUndefined, isArray, isIterable } from '@library/type.library';

/** shortcuts to FireService static properties and types */
export namespace fire {

	/**
	 * Array of Query functions with any limit / order criteria.  
	 * If a Where-clause contains an array of <values>, this indicates a logical-OR,
	 * and needs to be split into separate Queries, as Firestore does not currently
	 * allow 'or' in a complex Query
	 */
	export const fnQuery = (collection: COLLECTION, query: fire.Query = {}) => {
		return splitQuery(query)
			.map<QueryFn>(split =>
				(colRef: firebase.default.firestore.Query) => {															// map a Query-function
					if (split.where)
						asArray(split.where)
							.filter(where => !isUndefined(where.value))	// discard queries for 'undefined' value; not supported
							.forEach(where => colRef = colRef.where(where.fieldPath,
								(where.opStr || (isIterable(where.value) ? 'in' : '==')),
								isIterable(where.value) ? asArray(where.value) : where.value));			// coerce Set to Array

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
	const splitQuery = (query: fire.Query = {} as fire.Query) => {
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
						.map(value => fire.addWhere(where.fieldPath, value, where.opStr))
			})
			.cartesian();																// cartesian product of IWhere array

		const split: fire.Query[] = asArray(wheres)
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

	export const addWhere = (fieldPath: string | FieldPath, value: any, opStr?: fire.Where["opStr"]): fire.Where => {
		const operator = isArray(value) ? 'in' : '==';
		return { fieldPath, opStr: opStr ?? operator, value };
	}

	export const addOrder = (fieldPath: string | FieldPath, directionStr: fire.OrderBy["directionStr"] = 'asc'): fire.OrderBy =>
		({ fieldPath, directionStr });

	/** Query.where */
	export interface Where {
		fieldPath: string | firebase.default.firestore.FieldPath;
		opStr?: firebase.default.firestore.WhereFilterOp;
		value: any | any[] | Set<any>;
	}

	/** Query.orderBy */
	export interface OrderBy {
		fieldPath: string | firebase.default.firestore.FieldPath;
		directionStr?: firebase.default.firestore.OrderByDirection;
	}

	/** Collection.Query */
	export interface Query {
		where?: fire.Where | fire.Where[];
		orderBy?: fire.OrderBy | fire.OrderBy[];
		limit?: number;
		startAt?: string;
		startAfter?: string;
		endAt?: string;
		endBefore?: string;
	}

	/** FirestoreFunction getMeta() */
	export interface DocMeta {
		[FIELD.Id]: string;
		[FIELD.Create]?: number;
		[FIELD.Update]?: number;
		[FIELD.Access]?: number;
		exists: boolean;
		path: string;
		parent: string;
		subcollections?: string[];
	}
}
