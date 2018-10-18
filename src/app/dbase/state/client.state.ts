import { State, Action, StateContext, NgxsOnInit } from '@ngxs/store';
import { SLICE, IStoreState, IStoreDoc, SetClient, DelClient, TruncClient } from '@dbase/state/store.define';

import { FIELD } from '@dbase/data/data.define';
import { dbg } from '@lib/logger.library';

@State<IStoreState<IStoreDoc>>({
	name: SLICE.client,
	defaults: {}
})
export class ClientState implements NgxsOnInit {
	private dbg: Function = dbg.bind(this);

	constructor() { }

	ngxsOnInit(_ctx: StateContext<IStoreState<IStoreDoc>>) { this.dbg('init:'); }

	@Action(SetClient)
	setStore({ patchState, getState }: StateContext<IStoreState<IStoreDoc>>, { payload, debug }: SetClient) {
		const state = getState() || {};
		const store = this.filterClient(state, payload);

		store.push(payload);										// push the changed ClientDoc into the Store
		state[payload.store] = store;
		if (debug) this.dbg('setClient: %s, %j', payload.store, payload);
		patchState({ ...state });
	}

	@Action(DelClient)
	delStore({ patchState, getState }: StateContext<IStoreState<IStoreDoc>>, { payload, debug }: DelClient) {
		const state = getState() || {};
		const store = this.filterClient(getState(), payload);

		state[payload.store] = store;
		if (debug) this.dbg('delClient: %s, %j', payload.store, payload);
		patchState({ ...state });
	}

	@Action(TruncClient)
	truncStore({ setState }: StateContext<IStoreState<IStoreDoc>>, { debug }: TruncClient) {
		if (debug) this.dbg('truncClient');
		setState({});
	}

	/** remove an item from the Client Store */
	private filterClient(state: IStoreState<IStoreDoc>, payload: IStoreDoc) {
		const curr = state && state[payload.store] || [];

		return [...curr.filter(itm => itm[FIELD.id] !== payload[FIELD.id])];
	}

	/** Selectors */
	// static current(store: string, filter?: TWhere, sortBy: TString = []) {	// no longer used
	// 	return createSelector([ClientState], (state: IStoreState<IStoreDoc>) => {
	// 		const clone = cloneObj(state[store]);							// clone to avoid mutating original Store
	// 		const filters = asArray(filter);

	// 		filters.push({ fieldPath: FIELD.expire, value: 0 });
	// 		filters.push({ fieldPath: FIELD.hidden, value: false });

	// 		return clone
	// 			? asAt(clone, filters)
	// 				.sort(sortKeys(...asArray(sortBy)))						// apply any requested sort-criteria
	// 			: []
	// 	})
	// }

	// static store<T>(store: string, filter?: TWhere, date?: string | number) {
	// 	return createSelector([ClientState], (state: IStoreState<IStoreDoc>) => {
	// 		const clone = cloneObj(state[store]);
	// 		const filters = asArray(filter);

	// 		return asAt<T>(clone, filters, date);
	// 	})
	// }
}