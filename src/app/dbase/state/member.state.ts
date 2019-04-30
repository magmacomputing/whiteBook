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
	setStore({ setState, getState }: StateContext<TStateSlice<IStoreMeta>>, { payload, debug }: SetMember) {
		const state = getState() || {};

		asArray(payload).forEach(doc => {
			const store = doc[FIELD.store];
			state[store] = this.filterMember(state, doc);
			state[store].push(doc);							// push the changed MemberDoc into the Store
			if (debug) this.dbg('setMember: %j', doc);
		})

		setState({ ...state });
	}

	@Action(DelMember)
	delStore({ setState, getState }: StateContext<TStateSlice<IStoreMeta>>, { payload, debug }: DelMember) {
		const state = getState() || {};

		asArray(payload).forEach(doc => {
			const store = doc[FIELD.store];
			state[store] = this.filterMember(state, doc);

			if (state[store].length === 0)
				delete state[store];
			if (debug) this.dbg('delMember: %j', doc);
		})

		setState({ ...state });
	}

	@Action(TruncMember)
	truncStore({ setState }: StateContext<TStateSlice<IStoreMeta>>, { debug }: TruncMember) {
		if (debug) this.dbg('truncMember');
		setState({});
	}

	/** remove an item from the Member Store */
	private filterMember(state: TStateSlice<IStoreMeta>, payload: IStoreMeta) {
		const curr = state && state[payload[FIELD.store]] || [];

		return [...curr.filter(itm => itm[FIELD.id] !== payload[FIELD.id])];
	}
}