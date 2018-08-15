import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { StateContext, NgxsOnInit, createSelector } from '@ngxs/store';
import { IStoreState, IStoreDoc, ISelector } from '@dbase/state/store.define';
import { SetClient, DelClient } from '@dbase/state/store.define';
import { SetMember, DelMember } from '@dbase/state/store.define';
import { SetAttend, DelAttend } from '@dbase/state/store.define';

import { filterTable } from '@dbase/app/app.library';
import { FIELD } from '@dbase/data/data.define';
import { IWhere } from '@dbase/fire/fire.interface';

import { asArray, sortKeys, cloneObj } from '@lib/object.library';
import { dbg } from '@lib/logger.library';

/** a generic function that will invoke 'currStore' function on a particular Store */
export const getStore = <T>(obs$: Observable<ISelector<T>>, store: string, filter: IWhere | IWhere[] = [], sortBy: string | string[] = []) =>
	obs$.pipe(map(fn => fn(store, filter, sortBy)));

/** a memoized function that searches a Store for current documents */
export function currStore(state: IStoreState, store: string, filter: IWhere | IWhere[] = [], sortBy: string | string[] = []) {
	const clone = cloneObj(state[store]);							// clone to avoid mutating original Store
	const filters = asArray(cloneObj(filter));

	// filters.push({ fieldPath: FIELD.effect, opStr: '<=', value: getStamp() });
	filters.push({ fieldPath: FIELD.expire, value: 0 });
	filters.push({ fieldPath: FIELD.hidden, value: false });

	return clone
		? filterTable(clone, filters)
			.sort(sortKeys(...asArray(sortBy)))						// apply any requested sort-criteria
		: []
}

export class StoreState implements NgxsOnInit {
	private dbg: Function = dbg.bind(this);
	private name = this.constructor.name;

	constructor() { this.dbg('new'); }

	ngxsOnInit(_ctx: StateContext<IStoreState>) { this.dbg('onInit:'); }

	setStore({ patchState, getState }: StateContext<IStoreState>, { payload }: SetClient | SetMember | SetAttend) {
		const state = getState() || {};
		const store = this.filterStore(state, payload);

		store.push(payload);														// push the changed ClientDoc into the Store
		state[payload.store] = store;
		this.dbg('%s: %j', this.name, payload);
		patchState({ ...state });
	}

	delStore({ patchState, getState }: StateContext<IStoreState>, { payload }: DelClient | DelMember | DelAttend) {
		const state = getState() || {};
		const store = this.filterStore(getState(), payload);

		state[payload.store] = store;
		this.dbg('%s: %j', this.name, payload);
		patchState({ ...state });
	}

	truncStore({ setState }: StateContext<IStoreState>) {
		this.dbg('%s', this.name);
		setState({});
	}

	/** remove an item from the Client Store */
	private filterStore(state: IStoreState, payload: IStoreDoc) {
		const curr = state && state[payload.store] || [];

		return [...curr.filter(itm => itm[FIELD.id] !== payload[FIELD.id])];
	}
}
