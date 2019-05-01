import { State, Action, StateContext, NgxsOnInit, Store } from '@ngxs/store';
import { SetAdmin, DelAdmin, TruncAdmin, filterState } from '@dbase/state/state.action';
import { TStateSlice, SLICE } from '@dbase/state/state.define';

import { FIELD } from '@dbase/data/data.define';
import { IStoreMeta } from '@dbase/data/data.schema';

import { asArray } from '@lib/array.library';
import { dbg } from '@lib/logger.library';

/**
 * AdminState is for items only Users with roles['admin'] in their customClaims can see
 */
@State<TStateSlice<IStoreMeta>>({
	name: SLICE.admin,
	defaults: {}
})
export class AdminState implements NgxsOnInit {
	private dbg = dbg(this);

	constructor(private store: Store) { this.init(); }

	ngxsOnInit(_ctx: StateContext<TStateSlice<IStoreMeta>>) { this.init(); }

	private init() { this.dbg('init:'); }

	@Action(SetAdmin)
	setStore({ getState, setState }: StateContext<TStateSlice<IStoreMeta>>, { payload, debug }: SetAdmin) {
		const state = getState() || {};

		asArray(payload).forEach(doc => {
			const store = doc[FIELD.store];

			state[store] = filterState(state, doc);
			state[store].push(doc);							// push the changed AdminDoc into the Store

			if (debug) this.dbg('setAdmin: %j', doc);
		})

		setState({ ...state });
	}

	@Action(DelAdmin)
	delStore({ getState, setState }: StateContext<TStateSlice<IStoreMeta>>, { payload, debug }: DelAdmin) {
		const state = getState() || {};

		asArray(payload).forEach(doc => {
			const store = doc[FIELD.store];
			state[store] = filterState(state, doc);

			if (state[store].length === 0)
				delete state[store]

			if (debug) this.dbg('delAdmin: %s, %j', doc[FIELD.store], payload);
		})

		setState({ ...state });
	}

	@Action(TruncAdmin)
	truncStore({ setState }: StateContext<TStateSlice<IStoreMeta>>, { debug }: TruncAdmin) {
		if (debug) this.dbg('truncAdmin');
		setState({});
	}
}