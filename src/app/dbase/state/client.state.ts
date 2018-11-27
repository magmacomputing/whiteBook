import { State, Action, StateContext, NgxsOnInit } from '@ngxs/store';
import { SLICE, IStoreState, IStoreDoc, SetClient, DelClient, TruncClient } from '@dbase/state/store.define';

import { FIELD, STORE } from '@dbase/data/data.define';
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

		store.push(payload);										// push the new/changed ClientDoc into the Store
		state[payload[FIELD.store]] = store;

		if (debug) this.dbg('setClient: %s, %j', payload[FIELD.store], payload);
		patchState({ ...state });
	}

	@Action(DelClient)
	delStore({ patchState, getState }: StateContext<IStoreState<IStoreDoc>>, { payload, debug }: DelClient) {
		const state = getState() || {};
		const store = this.filterClient(getState(), payload);

		if (store.length === 0)
			delete state[payload[FIELD.store]]
		else state[payload[FIELD.store]] = store;

		if (debug) this.dbg('delClient: %s, %j', payload[FIELD.store], payload);
		patchState({ ...state });
	}

	@Action(TruncClient)
	truncStore({ setState }: StateContext<IStoreState<IStoreDoc>>, { debug }: TruncClient) {
		if (debug) this.dbg('truncClient');
		setState({});
	}

	/** remove an item from the Client Store */
	private filterClient(state: IStoreState<IStoreDoc>, payload: IStoreDoc) {
		const curr = state && state[payload[FIELD.store]] || [];

		return [...curr.filter(itm => itm[FIELD.id] !== payload[FIELD.id])];
	}
}
