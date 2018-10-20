import { State, Action, StateContext, NgxsOnInit } from '@ngxs/store';
import { SLICE } from '@dbase/state/store.define';
import { IStoreState, IMemberDoc } from '@dbase/state/store.define';
import { SetMember, DelMember, TruncMember } from '@dbase/state/store.define';

import { FIELD } from '@dbase/data/data.define';
import { dbg } from '@lib/logger.library';

@State<IStoreState<IMemberDoc>>({
	name: SLICE.member,
	defaults: {}
})
export class MemberState implements NgxsOnInit {
	private dbg: Function = dbg.bind(this);

	constructor() { }

	ngxsOnInit(_ctx: StateContext<IStoreState<IMemberDoc>>) { this.dbg('init:'); }

	@Action(SetMember)
	setStore({ patchState, getState }: StateContext<IStoreState<IMemberDoc>>, { payload, debug }: SetMember) {
		const state = getState() || {};
		const store = this.filterMember(state, payload);

		store.push(payload);										// push the changed MemberDoc into the Store
		state[payload.store] = store;
		if (debug) this.dbg('setMember: %j', payload);
		patchState({ ...state });
	}

	@Action(DelMember)
	delStore({ patchState, getState }: StateContext<IStoreState<IMemberDoc>>, { payload, debug }: DelMember) {
		const state = getState() || {};
		const store = this.filterMember(getState(), payload);

		state[payload.store] = store;
		if (debug) this.dbg('delMember: %j', payload);
		patchState({ ...state });
	}

	@Action(TruncMember)
	truncStore({ setState }: StateContext<IStoreState<IMemberDoc>>, { debug }: TruncMember) {
		if (debug) this.dbg('truncMember');
		setState({});
	}

	/** remove an item from the Member Store */
	private filterMember(state: IStoreState<IMemberDoc>, payload: IMemberDoc) {
		const curr = state && state[payload.store] || [];

		return [...curr.filter(itm => itm[FIELD.id] !== payload[FIELD.id])];
	}
}