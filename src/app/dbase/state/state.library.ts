import { Observable, defer, combineLatest, of } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';

import { TWhere } from '@dbase/fire/fire.interface';
import { TTokenClaims, IFireClaims } from '@dbase/auth/auth.interface';
import { asAt } from '@dbase/app/app.library';

import { IProfilePlan, IProfileInfo, IDefault, IPlan, IPrice, IPayment, ISchedule, IClass, IInstructor, ILocation, IEvent, ICalendar, IAttend } from '@dbase/data/data.schema';
import { SORTBY, STORE, FIELD } from '@dbase/data/data.define';
import { getSlice } from '@dbase/data/data.library';

import { asArray } from '@lib/array.library';
import { getPath, sortKeys, cloneObj } from '@lib/object.library';
import { isString, isNull, isArray, isUndefined } from '@lib/type.library';

export interface IState { [slice: string]: Observable<any> };

export interface IUserState {
	auth: {
		user: {                             // generic information returned from a Provider
			uid: string;
			providerId: string;
			displayName: string | null;
			email: string | null;
			photoURL: string | null;
		} | null;
		claims: TTokenClaims | null;        // authenticated customClaims
	}
}

export interface IMemberState extends IUserState {
	member: {
		plan?: IProfilePlan[];              // member's effective plan
		price?: IPrice[];                   // member's effective prices
		info?: IProfileInfo[];              // array of AdditionalUserInfo documents
	}
	defaults?: IDefault[];                // defaults to apply, if missing from Member data
}

export interface IPlanState extends IMemberState {
	client: {
		plan: IPlan[];                      // array of effective Plan documents
		price: IPrice[];                    // array of effective Price documents
	}
}

interface ISummary {
	pay: number;
	bank: number;
	pend: number;
	cost: number;
}
export interface IAccountState extends IMemberState {
	account: {
		payment: IPayment[];								// array of active payment documents
		attend: IAttend[];
		summary: ISummary;
		active?: string;										// the currently 'active' IPayment row
	}
}

export interface ITimetableState extends IMemberState {
	client: {
		schedule?: ISchedule[];
		class?: IClass[];
		event?: IEvent[];
		calendar?: ICalendar[];
		location?: ILocation[];
		instructor?: IInstructor[];
		price?: IPrice[];
	}
}

/** Generic Slice Observable */
export const getStore = <T>(states: IState, store: string, filter: TWhere = [], date?: number) => {
	const slice = getSlice(store);
	const state = states[slice];
	const sortBy = SORTBY[store];

	if (!state)
		throw new Error('Cannot resolve state from ' + store);

	return state.pipe(
		map(state => asAt(state[store], filter, date)),
		map(table => table.sort(sortKeys(...asArray(sortBy)))),
	)
}

/** extract the required fields from the AuthToken object */
export const getUser = (token: IFireClaims) =>
	({ displayName: token.name, email: token.email, photoURL: token.picture, providerId: token.firebase.sign_in_provider, uid: token.user_id });

/**
 * Join a Parent document to other documents referenced a supplied string of key fields  
 * states:  an object of States (eg. member$) which contains the to-be-referenced documents
 * node:   	the name of the node (eg. 'member') under which we place the documents on the State Object  
 * store:   the documents in the State with the supplied <store> field  
 * filter:  the Where-criteria to narrow down the document list  
 * date:    the as-at Date, to determine which documents are in the effective-range.
 */
export const joinDoc = (states: IState, node: string, store: string, filter: TWhere = [], date?: number) => {
	return (source: Observable<any>) => defer(() => {
		let parent: any;

		return source.pipe(
			switchMap(data => {
				const filters = decodeFilter(data, cloneObj(filter)); // loop through filters
				parent = data;                                        // stash the original parent data state

				return combineLatest(getStore(states, store, filters, date));
			}),

			map(res => {
				const nodes = node.split('.');
				let joins: { [key: string]: any[] } = parent[nodes[0]] || {};

				res.forEach(table => {
					if (table.length) {
						table.forEach((row: any) => {
							const type: string = (getSlice(store) === 'client')
								? row[FIELD.store]
								: (nodes[1] || row[FIELD.type])

							joins[type] = joins[type] || [];
							joins[type].push(row);
						})
					} else {
						joins[store] = joins[store] || [];								// if there are no documents that match the criteria, return empty array
					}
				})

				Object.keys(joins).map(table => {                     // apply any provided sortBy criteria
					if (isArray(joins[table])) {
						const sortBy = SORTBY[table];
						joins[table] = joins[table].sort(sortKeys(...asArray(sortBy)));
					}
				})

				return { ...parent, ...{ [nodes[0]]: joins } };
			})
		)
	})
}

/**
 * A helper function to analyze the <value> field of each filter.  
 * If <value> isString and matches {{...}}, it refers to the current <parent> data
 */
const decodeFilter = (parent: any, filter: TWhere) => {
	return asArray(filter).map(cond => {                        // loop through each filter

		cond.value = asArray(cond.value).map(value => {           // loop through filter's <value>

			const isPath = isString(value) && value.substring(0, 2) === '{{';
			let defaultValue: string | undefined;
			let lookup: any;

			if (isPath) {                                           // check if is it a fieldPath reference on the parent
				const child = value.replace('{{', '').replace('}}', '').replace(' ', '');
				const dflt = child.split('.').reverse()[0];           // get the last component of the fieldPath
				const table = (parent['default'][STORE.default] as IDefault[])
					.filter(row => row[FIELD.type] === dflt);           // find the default value for the requested fieldPath

				defaultValue = table.length && table[0][FIELD.key] || undefined;
				lookup = getPath(parent, child);

				if (isArray(lookup))                                  // if fieldPath doesnt exist on <parent>, then fallback to default
					lookup = lookup.map(res => isNull(res) || isUndefined(res) ? defaultValue : res);

			} else
				lookup = value;                                       // a use-able value with no interpolation needed

			return lookup;                                          // rebuild filter's <value>
		});

		if (cond.value.length === 1)
			cond.value = cond.value[0];                             // an array of only one value, return as string

		return cond;                                              // rebuild each filter
	})
}

/**
 * Use the Observable on active IPayment[] & IAttend[] to determine current account-status (credit, pending, bank, etc.)
 */
export const joinSum = () => {
	return (source: Observable<any>) => defer(() => {
		return source.pipe(
			map((source: IAccountState) => {												// calculate the Account summary
				const summary = { pay: 0, bank: 0, pend: 0, cost: 0, active: [] } as ISummary;

				if (source.account && isArray(source.account.payment)) {
					source.account.summary = source.account.payment.reduce((sum, account: any) => {
						if (account.approve) sum.pay += account.amount;
						if (account.active) sum.bank += account.bank || 0;
						if (!account.approve) sum.pend += account.amount;
						return sum
					}, summary)
				}

				if (source.account && isArray(source.account.attend)) {
					source.account.attend.reduce((sum, attend) => {			// get the Attend docs related to the active Account doc
						sum.cost += attend.cost														// add up each Attend's cost
						return sum;
					}, summary)
				}

				return { ...source };
			}),
		)
	})
}

/**
 * There is only 1 Account marked 'active' at any time.  
 * The rest are assumed to be pre-payments.
 */
export const getActive = () => {
	return (source: Observable<any>) => defer(() => {
		return source.pipe(
			map((source: IAccountState) => {
				if (source.account && isArray(source.account.payment)) {
					const payments = source.account.payment
						.filter(row => row.active)[0];										// get the first 'active' document found
					source.account.active = payments[FIELD.id];					// and stash it's FIELD.id
				}

				return { ...source };
			}),
		)
	})
} 
