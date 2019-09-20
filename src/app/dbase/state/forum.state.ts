import { State, Action, StateContext, NgxsOnInit } from '@ngxs/store';
import { TStateSlice, SLICE } from '@dbase/state/state.define';
import { IStoreMeta } from '@dbase/data/data.schema';
import { SetForum, DelForum, TruncForum, filterState } from '@dbase/state/state.action';

import { FIELD } from '@dbase/data/data.define';
import { asArray } from '@lib/array.library';
import { cloneObj } from '@lib/object.library';
import { dbg } from '@lib/logger.library';

@State<TStateSlice<IStoreMeta>>({
	name: SLICE.forum,
	defaults: {}
})
export class ForumState implements NgxsOnInit {
	private dbg = dbg(this);

	constructor() { this.init(); }

	ngxsOnInit(_ctx: StateContext<TStateSlice<IStoreMeta>>) { this.init(); }

	private init() {
		this.dbg('init:');
	}

	@Action(SetForum)
	setStore({ getState, setState }: StateContext<TStateSlice<IStoreMeta>>, { payload, debug }: SetForum) {
		const state = cloneObj(getState()) || {};

		asArray(payload).forEach(doc => {
			const store = doc[FIELD.store];

			state[store] = filterState(state, doc);
			state[store].push(doc);							// push the changed ForumDoc into the Store

			if (debug) this.dbg('setForum: %j', doc);
		})

		setState({ ...state });
	}

	@Action(DelForum)
	delStore({ getState, setState }: StateContext<TStateSlice<IStoreMeta>>, { payload, debug }: DelForum) {
		const state = cloneObj(getState()) || {};
		const segment = FIELD.store;

		asArray(payload).forEach(doc => {
			const slice = doc[segment];
			state[slice] = filterState(state, doc, segment);

			if (state[slice].length === 0)
				delete state[slice];
			if (debug) this.dbg('delForum: %j', doc);
		})

		setState({ ...state });
	}

	@Action(TruncForum)
	truncStore({ setState }: StateContext<TStateSlice<IStoreMeta>>, { debug }: TruncForum) {
		if (debug) this.dbg('truncForum');
		setState({});
	}
}