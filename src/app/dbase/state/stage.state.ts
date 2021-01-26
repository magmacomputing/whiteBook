import { Injectable } from '@angular/core';
import { State, Action, StateContext, NgxsOnInit } from '@ngxs/store';

import { stageAction, filterState } from '@dbase/state/state.action';
import type { TStateSlice } from '@dbase/state/state.define';

import { FIELD, COLLECTION } from '@dbase/data.define';
import type { FireDocument } from '@dbase/data.schema';

import { asArray } from '@library/array.library';
import { cloneObj } from '@library/object.library';
import { dbg } from '@library/logger.library';

/**
 * StageState is for items that only Admin Users (with roles['admin'] in their customClaims) can see
 */
@Injectable()
@State<TStateSlice<FireDocument>>({
	name: COLLECTION.Stage,
	defaults: {}
})
export class StageState implements NgxsOnInit {
	private dbg = dbg(this);

	constructor() { this.init(); }

	ngxsOnInit(_ctx: StateContext<TStateSlice<FireDocument>>) { /**this.init(); */ }

	private init() { this.dbg('init:'); }

	@Action(stageAction.Set)
	setStore({ getState, setState }: StateContext<TStateSlice<FireDocument>>, { payload, debug }: stageAction.Set) {
		const state = cloneObj(getState()) || {};

		asArray(payload).forEach(doc => {
			const store = doc[FIELD.Store];

			state[store] = filterState(state, doc, FIELD.Store);
			state[store].push(doc);							// push the changed StageDoc into the Store

			if (debug) this.dbg('setStage: %j', doc);
		})

		setState({ ...state });
	}

	@Action(stageAction.Del)
	delStore({ getState, setState }: StateContext<TStateSlice<FireDocument>>, { payload, debug }: stageAction.Del) {
		const state = cloneObj(getState()) || {};

		asArray(payload).forEach(doc => {
			const store = doc[FIELD.Store];

			state[store] = filterState(state, doc, FIELD.Store);
			if (state[store].length === 0)
				delete state[store]

			if (debug) this.dbg('delStage: %s, %j', doc[FIELD.Store], doc);
		})

		setState({ ...state });
	}

	@Action(stageAction.Clear)
	clearStore({ setState }: StateContext<TStateSlice<FireDocument>>, { debug }: stageAction.Clear) {
		if (debug) this.dbg('clearStage');
		setState({});
	}
}