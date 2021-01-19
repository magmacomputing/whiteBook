import { FIELD } from '@dbase/data.define';
import { isArray } from '@library/type.library';

/** shortcuts to FireService static properties and types */
export namespace fire {

	export const addWhere = (fieldPath: string | firebase.default.firestore.FieldPath, value: any, opStr?: fire.Where["opStr"]): fire.Where => {
		const operator = isArray(value) ? 'in' : '==';
		return { fieldPath, opStr: opStr ?? operator, value };
	}

	export const addOrder = (fieldPath: string | firebase.default.firestore.FieldPath, directionStr: fire.OrderBy["directionStr"] = 'asc'): fire.OrderBy =>
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
