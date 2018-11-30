import { State, Action, StateContext, NgxsOnInit } from '@ngxs/store';
import { SLICE } from '@dbase/state/slice.define';
import { IStateSlice } from '@dbase/state/slice.define';
import { IStoreMeta } from '@dbase/data/data.schema';
import { SetMember, DelMember, TruncMember } from '@dbase/state/slice.define';

import { FIELD } from '@dbase/data/data.define';
import { dbg } from '@lib/logger.library';

@State<IStateSlice<IStoreMeta>>({
	name: SLICE.member,
	defaults: {}
})
export class MemberState implements NgxsOnInit {
	private dbg: Function = dbg.bind(this);

	constructor() { }

	ngxsOnInit(_ctx: StateContext<IStateSlice<IStoreMeta>>) { this.dbg('init:'); }

	@Action(SetMember)
	setStore({ patchState, getState }: StateContext<IStateSlice<IStoreMeta>>, { payload, debug }: SetMember) {
		const state = getState() || {};
		const store = this.filterMember(state, payload);

		store.push(payload);										// push the changed MemberDoc into the Store
		state[payload.store] = store;
		if (debug) this.dbg('setMember: %j', payload);
		patchState({ ...state });
	}

	@Action(DelMember)
	delStore({ patchState, getState }: StateContext<IStateSlice<IStoreMeta>>, { payload, debug }: DelMember) {
		const state = getState() || {};
		const store = this.filterMember(state, payload);

		if (store.length === 0)
			delete state[payload.store]
		else state[payload.store] = store;
		if (debug) this.dbg('delMember: %j', payload);
		patchState({ ...state });
	}

	@Action(TruncMember)
	truncStore({ setState }: StateContext<IStateSlice<IStoreMeta>>, { debug }: TruncMember) {
		if (debug) this.dbg('truncMember');
		setState({});
	}

	/** remove an item from the Member Store */
	private filterMember(state: IStateSlice<IStoreMeta>, payload: IStoreMeta) {
		const curr = state && state[payload.store] || [];

		return [...curr.filter(itm => itm[FIELD.id] !== payload[FIELD.id])];
	}
}