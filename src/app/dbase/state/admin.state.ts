import { State, Action, StateContext, NgxsOnInit, Store } from '@ngxs/store';
import { SetAdmin, DelAdmin, TruncAdmin } from '@dbase/state/state.action';
import { TStateSlice, SLICE } from '@dbase/state/state.define';

import { FIELD } from '@dbase/data/data.define';
import { IStoreMeta } from '@dbase/data/data.schema';

import { dbg } from '@lib/logger.library';

/**
 * AdminState is for items only Users with roles['isAdmin'] in their customClaims can see
 */
@State<TStateSlice<IStoreMeta>>({
	name: SLICE.admin,
	defaults: {}
})
export class AdminState implements NgxsOnInit {
	private dbg = dbg(this);

	constructor(private store: Store) { }

	ngxsOnInit(_ctx: StateContext<TStateSlice<IStoreMeta>>) { this.dbg('init:'); }

	@Action(SetAdmin)
	setStore({ patchState, getState }: StateContext<TStateSlice<IStoreMeta>>, { payload, debug }: SetAdmin) {
		const state = getState() || {};
		const store = this.filterAdmin(state, payload);

		store.push(payload);										// push the changed AdminDoc into the Store
		state[payload.store] = store;
		if (debug) this.dbg('setAdmin: %j', payload);
		patchState({ ...state });
	}

	@Action(DelAdmin)
	delStore({ patchState, getState }: StateContext<TStateSlice<IStoreMeta>>, { payload, debug }: DelAdmin) {
		const state = getState() || {};
		const store = this.filterAdmin(getState(), payload);

		if (store.length === 0)
			delete state[payload[FIELD.store]]
		else state[payload[FIELD.store]] = store;

		if (debug) this.dbg('delAdmin: %s, %j', payload[FIELD.store], payload);
		patchState({ ...state });
	}

	@Action(TruncAdmin)
	truncStore({ setState }: StateContext<TStateSlice<IStoreMeta>>, { debug }: TruncAdmin) {
		if (debug) this.dbg('truncAdmin');
		setState({});
	}

	/** remove an item from the Admin Store */
	private filterAdmin(state: TStateSlice<IStoreMeta>, payload: IStoreMeta) {
		const curr = state && state[payload[FIELD.store]] || [];

		return [...curr.filter(itm => itm[FIELD.id] !== payload[FIELD.id])];
	}
}