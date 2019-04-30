import { State, Action, StateContext, NgxsOnInit } from '@ngxs/store';
import { TStateSlice, SLICE } from '@dbase/state/state.define';
import { IStoreMeta } from '@dbase/data/data.schema';
import { SetMember, DelMember, TruncMember } from '@dbase/state/state.action';

import { FIELD } from '@dbase/data/data.define';
import { asArray } from '@lib/array.library';
import { dbg } from '@lib/logger.library';

@State<TStateSlice<IStoreMeta>>({
	name: SLICE.member,
	defaults: {}
})
export class MemberState implements NgxsOnInit {
	private dbg = dbg(this);

	constructor() { this.init(); }

	ngxsOnInit(_ctx: StateContext<TStateSlice<IStoreMeta>>) { this.init(); }

	private init() {
		this.dbg('init:');
	}

	@Action(SetMember)
	setStore({ patchState, getState }: StateContext<TStateSlice<IStoreMeta>>, { payload, debug }: SetMember) {
		const state = getState() || {};

		asArray(payload).forEach(doc => {
			const store = this.filterMember(state, doc);

			store.push(doc);										// push the changed MemberDoc into the Store
			state[doc.store] = store;
			if (debug) this.dbg('setMember: %j', doc);
			patchState({ ...state });
		})
	}

	@Action(DelMember)
	delStore({ patchState, getState }: StateContext<TStateSlice<IStoreMeta>>, { payload, debug }: DelMember) {
		const state = getState() || {};
		
		asArray(payload).forEach(doc => {
			const store = this.filterMember(state, doc);

			if (store.length === 0)
				delete state[doc.store]
			else state[doc.store] = store;
			if (debug) this.dbg('delMember: %j', doc);
			patchState({ ...state });
		})
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