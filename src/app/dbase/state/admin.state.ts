import { Injectable } from '@angular/core';
import { State, Action, StateContext, NgxsOnInit } from '@ngxs/store';

import { adminAction, filterState } from '@dbase/state/state.action';
import type { TStateSlice } from '@dbase/state/state.define';

import { FIELD, COLLECTION } from '@dbase/data.define';
import type { FireDocument } from '@dbase/data.schema';

import { asArray } from '@library/array.library';
import { cloneObj } from '@library/object.library';
import { dbg } from '@library/logger.library';

/**
 * AdminState is for items that only Admin Users (with roles['admin'] in their customClaims) can see
 */
@Injectable()
@State<TStateSlice<FireDocument>>({
	name: COLLECTION.Admin,
	defaults: {}
})
export class AdminState implements NgxsOnInit {
	private dbg = dbg(this);

	constructor() { this.init(); }

	ngxsOnInit(_ctx: StateContext<TStateSlice<FireDocument>>) { /**this.init(); */ }

	private init() { this.dbg('init:'); }

	@Action(adminAction.Set)
	setStore({ getState, setState }: StateContext<TStateSlice<FireDocument>>, { payload, debug }: adminAction.Set) {
		const state = cloneObj(getState()) || {};

		asArray(payload).forEach(doc => {
			const store = doc[FIELD.Type] || doc[FIELD.Store];
			const segment = doc[FIELD.Type] ? FIELD.Type : FIELD.Store;

			state[store] = filterState(state, doc, segment);
			state[store].push(doc);							// push the changed AdminDoc into the Store

			if (debug) this.dbg('setAdmin: %j', doc);
		})

		setState({ ...state });
	}

	@Action(adminAction.Del)
	delStore({ getState, setState }: StateContext<TStateSlice<FireDocument>>, { payload, debug }: adminAction.Del) {
		const state = cloneObj(getState()) || {};

		asArray(payload).forEach(doc => {
			const store = doc[FIELD.Type] || doc[FIELD.Store];
			const segment = doc[FIELD.Type] ? FIELD.Type : FIELD.Store;

			state[store] = filterState(state, doc, segment);
			if (state[store].length === 0)
				delete state[store]

			if (debug) this.dbg('delAdmin: %s, %j', doc[segment], doc);
		})

		setState({ ...state });
	}

	@Action(adminAction.Clear)
	clearStore({ setState }: StateContext<TStateSlice<FireDocument>>, { debug }: adminAction.Clear) {
		if (debug) this.dbg('clearAdmin');
		setState({});
	}
}