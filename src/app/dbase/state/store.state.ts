import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { StateContext, NgxsOnInit } from '@ngxs/store';
import { IStoreState, IStoreDoc, ISelector } from '@dbase/state/store.define';
import { SetClient, DelClient } from '@dbase/state/store.define';
import { SetMember, DelMember } from '@dbase/state/store.define';
import { SetAttend, DelAttend } from '@dbase/state/store.define';

import { FIELD } from '@dbase/data/data.define';
import { dbg } from '@lib/logger.library';
import { IWhere } from '@dbase/fire/fire.interface';
import { asArray, sortKeys } from '@lib/object.library';
import { filterTable } from '@dbase/app/app.library';

/** a generic function that will invoke 'currStore' function on a particular Store */
export const getStore = (obs$: Observable<ISelector>, store: string, filter: IWhere | IWhere[] = [], keys: string | string[] = []) =>
	obs$.pipe(map(fn => fn(store, filter, keys)));

/** a memoized function that searches a Store for current documents */
export function currStore(state: IStoreState, store: string, filter: IWhere | IWhere[] = [], keys: string | string[] = []) {
	const filters = asArray(filter);
	filters.push({ fieldPath: FIELD.expire, opStr: '==', value: 0 });
	filters.push({ fieldPath: FIELD.hidden, opStr: '==', value: 0 });

	return state
		? filterTable<IStoreDoc>(state[store], filters)
			.sort(sortKeys(...asArray(keys)))							// apply any requested sort-criteria
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

		store.push(payload);										// push the changed ClientDoc into the Store
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