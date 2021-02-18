import type { FIELD } from '@dbase/data.define';
import { isArray } from '@library/type.library';

/** shortcuts to FireService static properties and types */
export namespace Fire {

	export const addWhere = (fieldPath: string | firebase.default.firestore.FieldPath, value: any, opStr?: Fire.Where["opStr"]): Fire.Where => {
		const operator = isArray(value) ? 'in' : '==';
		return { fieldPath, opStr: opStr ?? operator, value };
	}

	export const addOrder = (fieldPath: string | firebase.default.firestore.FieldPath, directionStr: Fire.OrderBy["directionStr"] = 'asc'): Fire.OrderBy =>
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
		[FIELD.Id]: string;
		[FIELD.Create]?: number;
		[FIELD.Update]?: number;
		[FIELD.Access]?: number;
		exists: boolean;
		path: string;
		parent: string;
		subcollections?: string[];
	}

	/** extract from QueryDocumentSnapshot */
	export interface FireSnap<T> {
		type: firebase.default.firestore.DocumentChangeType;
		metadata: firebase.default.firestore.SnapshotMetadata;
		doc: T;
	}
}
