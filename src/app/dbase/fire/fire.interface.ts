import * as firebase from 'firebase/app';
import { FieldPath } from '@angular/fire/firestore';

import { FIELD } from '@dbase/data/data.define';

/** Query.where */
export interface IWhere {
	fieldPath: string | FieldPath;
	opStr?: firebase.firestore.WhereFilterOp | '!=';				// this is a *special* to allow additional operator (do not use on Firestore database!)
	value: any | any[];
}
export type TWhere = IWhere | IWhere[];

/** Query.orderBy */
export interface IOrderBy {
	fieldPath: string | FieldPath;
	directionStr?: 'desc' | 'asc';
}
/** Collection.Query */
export interface IQuery {
	where?: TWhere;
	orderBy?: IOrderBy | IOrderBy[];
	limitTo?: number;
}

/** FirestoreFunction getMeta() */
export interface IDocMeta {
	exists: boolean;
	[FIELD.id]: string;
	[FIELD.create]?: number;
	[FIELD.update]?: number;
	[FIELD.access]?: number;
	subcollections: string[];
	path: string;
}