import { Observable, defer, combineLatest } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';

import { TWhere } from '@dbase/fire/fire.interface';
import { IFireClaims } from '@dbase/auth/auth.interface';
import { asAt } from '@dbase/app/app.library';

import { IState, IAccountState, ITimetableState } from '@dbase/state/state.define';
import { IDefault, IStoreMeta, TStoreBase } from '@dbase/data/data.schema';
import { SORTBY, STORE, FIELD } from '@dbase/data/data.define';
import { getSlice } from '@dbase/data/data.library';

import { asArray, deDup } from '@lib/array.library';
import { getPath, sortKeys, cloneObj } from '@lib/object.library';
import { isString, isNull, isArray, isUndefined, isFunction } from '@lib/type.library';
import { fmtDate, DATE_KEY } from '@lib/date.library';

/**
 * Generic Slice Observable  
 * Special logic to slice 'attend' store, as it uses non-standard indexing
 */
export const getStore = <T extends IStoreMeta>(states: IState, store: string, filter: TWhere = [], date?: number, index?: string) => {
	const slice = getSlice(store);
	const state = states[slice] as Observable<IStoreMeta>;
	const sortBy = SORTBY[store];

	if (!state)
		throw new Error(`Cannot resolve state from ${store}`);

	return state.pipe(
		map(state => asAt<T>(state[index || store], filter, date)),
		map(table => table && table.sort(sortKeys(...asArray(sortBy)))),
	)
}

/** extract the required fields from the AuthToken object */
export const getUser = (token: IFireClaims) =>
	({ displayName: token.name, email: token.email, photoURL: token.picture, providerId: token.firebase.sign_in_provider, uid: token.user_id });

/**
 * Join a document to other documents referenced a supplied string of key fields  
 * states:  an object of States (eg. member$) which contains the to-be-referenced documents
 * node:   	the name of the node (eg. 'member') under which we place the documents on the Observable Object  
 * store:   the parent documents in the State with the supplied <store> field  
 * filter:  the Where-criteria to narrow down the document list  
 * date:    the as-at Date, to determine which documents are in the effective-range.
 */
export const joinDoc = (states: IState, node: string | undefined, store: string, filter: TWhere = [], date?: number, callBack?: Function) => {
	return (source: Observable<any>) => defer(() => {
		let parent: any;

		return source.pipe(
			switchMap(data => {
				const filters = decodeFilter(data, cloneObj(filter)); // loop through filters
				const index = (store === STORE.attend) ? filters[0].value : store;	// TODO: dont rely on defined filter

				parent = data;                                        // stash the original parent data state

				return combineLatest(getStore<TStoreBase>(states, store, filters, date, index));
			}),

			map(res => {
				const nodes = node && node.split('.') || [];
				let joins: { [key: string]: TStoreBase[] } = nodes[0] && parent[nodes[0]] || {};

				res.forEach(table => {
					if (table.length) {
						table.forEach(row => {
							const type = (getSlice(store) === 'client')
								? row[FIELD.store]
								: (nodes[1] || row[FIELD.type] || row[FIELD.store])

							joins[type] = joins[type] || [];
							joins[type] = joins[type].filter(item => item[FIELD.id] !== row[FIELD.id]);
							joins[type].push(row);
						})
					} else {
						const type = nodes[1] || store;
						joins[type] = joins[type] || [];									// if there are no documents that match the criteria, return empty array
					}
				})

				Object.keys(joins).map(table => {                     // apply any provided sortBy criteria
					if (isArray(joins[table])) {
						const sortBy = SORTBY[table];
						joins[table] = joins[table].sort(sortKeys(...asArray(sortBy)));
					}
				})

				return node
					? { ...parent, ...{ [nodes[0]]: joins } }
					: { ...parent, ...joins }
			}),

			map(data => isFunction(callBack) ? callBack(data) : data),
		)
	})
}

/**
 * A helper function to analyze the <value> field of each filter.  
 * If <value> isString and matches {{...}}, it refers to the current <parent> data
 */
const decodeFilter = (parent: any, filter: TWhere) => {
	return asArray(filter).map(cond => {                      // loop through each filter

		cond.value = asArray(cond.value).flatMap(value => {    	// loop through filter's <value>, flatten array of arrays
			const isPath = isString(value) && value.substring(0, 2) === '{{';
			let lookup = value;

			if (isPath) {                                         // check if is it a fieldPath reference on the parent
				const child = value.replace('{{', '').replace('}}', '').replace(' ', '');
				const dflt = child.split('.').reverse()[0];         // get the last component of the fieldPath
				const table = (parent['default'][STORE.default] as IDefault[])
					.filter(row => row[FIELD.type] === dflt);         // find the default value for the requested fieldPath
				const defaultValue = table.length && table[0][FIELD.key] || undefined;

				lookup = getPath(parent, child);
				if (isArray(lookup))                              	// if fieldPath doesnt exist on <parent>, then fallback to default
					lookup = lookup.map((res: any) => isNull(res) || isUndefined(res) ? defaultValue : res);
			}

			return lookup;                                        // rebuild filter's <value>
		})

		if (cond.value.length === 1)
			cond.value = cond.value[0];                           // an array of only one value, return as string

		return cond;                                            // rebuild each filter
	})
}

/**
 * Use the Observable on open IPayment[] to determine current account-status (paid, pending, bank, etc.).  
 * The IPayment array is pre-sorted by 'stamp', meaning payment[0] is active.  
 * paid		: is amount from active payment  
 * bank		: is any unspent credit on active payment (brought forward from previous payment)  
 * pend 	: is amount from future payments  
 */
export const sumPayment = (source: IAccountState) => {
	if (source.account && isArray(source.account.payment)) {
		source.account.summary = source.account.payment
			.reduce((sum, payment, indx) => {
				if (indx === 0 && payment[FIELD.effect]) {
					sum.bank += payment.bank || 0;
					sum.paid += payment.amount || 0;
				}
				else sum.pend += payment.amount

				return sum;
			}, { paid: 0, bank: 0, pend: 0, spend: 0 })
	}

	return source;
}

/** Use the Observable on IAttend[] to add-up the cost of the Classes on the active IPayment */
export const sumAttend = (source: IAccountState) => {
	if (source.account && isArray(source.account.attend)) {
		source.account.summary.spend = source.account.attend
			.reduce((spend, attend) => spend + attend.amount, 0);
	}

	return source;
}

/** calc a 'day' field onto any Calendar row */
export const calendarDay = (source: ITimetableState) => {
	if (source.client.calendar) {
		source.client.calendar = source.client.calendar.map(row => {
			row.day = fmtDate<number>(DATE_KEY.weekDay, row[FIELD.key])
			return row;
		})
	}

	return { ...source };
}
