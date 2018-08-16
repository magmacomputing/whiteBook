import { State, Action, StateContext, Selector, NgxsOnInit, createSelector } from '@ngxs/store';
import { SLICE, IStoreState, IStoreDoc, SetClient, DelClient, TruncClient } from '@dbase/state/store.define';

import { filterTable, asAt } from '@dbase/app/app.library';
import { FIELD } from '@dbase/data/data.define';
import { IWhere } from '@dbase/fire/fire.interface';

import { cloneObj, asArray, sortKeys } from '@lib/object.library';
import { dbg } from '@lib/logger.library';

@State<IStoreState>({
	name: SLICE.client,
	defaults: {}
})
export class ClientState implements NgxsOnInit {
	private dbg: Function = dbg.bind(this);

	constructor() { }

	ngxsOnInit(_ctx: StateContext<IStoreState>) { this.dbg('init:'); }

	@Action(SetClient)
	setStore({ patchState, getState }: StateContext<IStoreState>, { payload, debug }: SetClient) {
		const state = getState() || {};
		const store = this.filterClient(state, payload);

		store.push(payload);										// push the changed ClientDoc into the Store
		state[payload.store] = store;
		if (debug) this.dbg('setClient: %s, %j', payload.store, payload);
		patchState({ ...state });
	}

	@Action(DelClient)
	delStore({ patchState, getState }: StateContext<IStoreState>, { payload, debug }: DelClient) {
		const state = getState() || {};
		const store = this.filterClient(getState(), payload);

		state[payload.store] = store;
		if (debug) this.dbg('delClient: %s, %j', payload.store, payload);
		patchState({ ...state });
	}

	@Action(TruncClient)
	truncStore({ setState }: StateContext<IStoreState>) {
		this.dbg('truncClient');
		setState({});
	}

	/** remove an item from the Client Store */
	private filterClient(state: IStoreState, payload: IStoreDoc) {
		const curr = state && state[payload.store] || [];

		return [...curr.filter(itm => itm[FIELD.id] !== payload[FIELD.id])];
	}

	/** Selectors */
	static current(store: string, filter?: IWhere | IWhere[], sortBy: string | string[] = []) {
		return createSelector([ClientState], (state: IStoreState) => {
			const clone = cloneObj(state[store]);							// clone to avoid mutating original Store
			const filters = asArray(cloneObj(filter));

			filters.push({ fieldPath: FIELD.expire, value: 0 });
			filters.push({ fieldPath: FIELD.hidden, value: false });

			return clone
				? asAt(clone, filters)
					.sort(sortKeys(...asArray(sortBy)))						// apply any requested sort-criteria
				: []
		})
	}

	static store<T>(store: string, filter?: IWhere | IWhere[], date?: string | number) {
		return createSelector([ClientState], (state: IStoreState) => {
			const clone = cloneObj(state[store]);
			const filters = asArray(cloneObj(filter));

			return asAt<T>(clone as any[], filters, date);
		})
	}
}