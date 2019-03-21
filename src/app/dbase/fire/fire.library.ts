import * as firebase from 'firebase/app';
import { Query, FieldPath } from '@angular/fire/firestore';
import { IQuery, IWhere } from '@dbase/fire/fire.interface';

import { asArray } from '@lib/array.library';
import { isNumeric } from '@lib/string.library';
import { isUndefined } from '@lib/type.library';

/** Collection reference, with any limit / order criteria */
export const fnQuery = (query: IQuery = {}) => {
	const fns: ((colRef: firebase.firestore.Query) => firebase.firestore.Query)[] = [];

	fns.push(
		(colRef: Query) => {															// return a Query-function
			if (query.where)
				asArray(query.where)
					.filter(qry => !isUndefined(qry.value))						// discard queries for 'undefined' value
					.forEach(qry => colRef = colRef.where(qry.fieldPath, (qry.opStr || '==') as firebase.firestore.WhereFilterOp, qry.value));

			if (query.orderBy)
				asArray(query.orderBy)
					.forEach(order => colRef = colRef.orderBy(order.fieldPath, order.directionStr));

			if (isNumeric(query.limitTo))
				colRef = colRef.limit(query.limitTo as number);

			return colRef;
		}
	)
	return fns;
}

/** Make a 'where' clause */
export const addWhere = (fieldPath: string | FieldPath, value: any, opStr: IWhere["opStr"] = '==') => {
	const where: IWhere = { fieldPath, value };
	if (opStr) where.opStr = opStr;
	return where;
}