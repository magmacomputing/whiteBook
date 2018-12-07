import { State, Action, StateContext, NgxsOnInit } from '@ngxs/store';
import { TStateSlice } from '@dbase/state/state.define';
import { IStoreMeta } from '@dbase/data/data.schema';
import { SLICE, SetMember, DelMember, TruncMember } from '@dbase/state/state.action';

import { FIELD } from '@dbase/data/data.define';
import { dbg } from '@lib/logger.library';

@State<TStateSlice<IStoreMeta>>({
	name: SLICE.member,
	defaults: {}
})
export class MemberState implements NgxsOnInit {
	private dbg = dbg(this);

	constructor() { }

	ngxsOnInit(_ctx: StateContext<TStateSlice<IStoreMeta>>) { this.dbg('init:'); }

	@Action(SetMember)
	setStore({ patchState, getState }: StateContext<TStateSlice<IStoreMeta>>, { payload, debug }: SetMember) {
		const state = getState() || {};
		const store = this.filterMember(state, payload);

		store.push(payload);										// push the changed MemberDoc into the Store
		state[payload.store] = store;
		if (debug) this.dbg('setMember: %j', payload);
		patchState({ ...state });
	}

	@Action(DelMember)
	delStore({ patchState, getState }: StateContext<TStateSlice<IStoreMeta>>, { payload, debug }: DelMember) {
		const state = getState() || {};
		const store = this.filterMember(state, payload);

		if (store.length === 0)
			delete state[payload.store]
		else state[payload.store] = store;
		if (debug) this.dbg('delMember: %j', payload);
		patchState({ ...state });
	}

	@Action(TruncMember)
	truncStore({ setState }: StateContext<TStateSlice<IStoreMeta>>, { debug }: TruncMember) {
		if (debug) this.dbg('truncMember');
		setState({});
	}

	/** remove an item from the Member Store */
	private filterMember(state: TStateSlice<IStoreMeta>, payload: IStoreMeta) {
		const curr = state && state[payload.store] || [];

		return [...curr.filter(itm => itm[FIELD.id] !== payload[FIELD.id])];
	}
}