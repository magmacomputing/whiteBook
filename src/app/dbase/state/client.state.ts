import { State, Action, StateContext, NgxsOnInit, Store } from '@ngxs/store';
import { SetClient, DelClient, TruncClient, SetLocal } from '@dbase/state/state.action';
import { TStateSlice, SLICE } from '@dbase/state/state.define';

import { FIELD, STORE } from '@dbase/data/data.define';
import { IStoreMeta } from '@dbase/data/data.schema';

import { dbg } from '@lib/logger.library';

@State<TStateSlice<IStoreMeta>>({
	name: SLICE.client,
	defaults: {}
})
export class ClientState implements NgxsOnInit {
	private dbg = dbg(this);

	constructor(private readonly store: Store) { }

	ngxsOnInit(_ctx: StateContext<TStateSlice<IStoreMeta>>) { this.dbg('init:'); }

	@Action(SetClient)
	setStore({ patchState, getState }: StateContext<TStateSlice<IStoreMeta>>, { payload, debug }: SetClient) {
		const state = getState() || {};
		const store = this.filterClient(state, payload);

		store.push(payload);										// push the new/changed ClientDoc into the Store
		state[payload[FIELD.store]] = store;

		if (payload[FIELD.store] === STORE.config)
			this.store.dispatch(new SetLocal(payload));

		if (debug) this.dbg('setClient: %s, %j', payload[FIELD.store], payload);
		patchState({ ...state });
	}

	@Action(DelClient)
	delStore({ patchState, getState }: StateContext<TStateSlice<IStoreMeta>>, { payload, debug }: DelClient) {
		const state = getState() || {};
		const store = this.filterClient(getState(), payload);

		if (store.length === 0)
			delete state[payload[FIELD.store]]
		else state[payload[FIELD.store]] = store;

		if (debug) this.dbg('delClient: %s, %j', payload[FIELD.store], payload);
		patchState({ ...state });
	}

	@Action(TruncClient)
	truncStore({ setState }: StateContext<TStateSlice<IStoreMeta>>, { debug }: TruncClient) {
		if (debug) this.dbg('truncClient');
		setState({});
	}

	/** remove an item from the Client Store */
	private filterClient(state: TStateSlice<IStoreMeta>, payload: IStoreMeta) {
		const curr = state && state[payload[FIELD.store]] || [];

		return [...curr.filter(itm => itm[FIELD.id] !== payload[FIELD.id])];
	}
}