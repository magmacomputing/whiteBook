import { Injectable } from '@angular/core';
import { State, Action, StateContext, NgxsOnInit } from '@ngxs/store';

import type { TStateSlice } from '@dbase/state/state.define';
import type { FireDocument } from '@dbase/data.schema';
import { memberAction, filterState } from '@dbase/state/state.action';
import { COLLECTION, FIELD } from '@dbase/data.define';

import { asArray } from '@library/array.library';
import { cloneObj } from '@library/object.library';
import { dbg } from '@library/logger.library';

@Injectable()
@State<TStateSlice<FireDocument>>({
	name: COLLECTION.Member,
	defaults: {}
})
export class MemberState implements NgxsOnInit {
	private dbg = dbg(this);

	constructor() { this.init(); }

	ngxsOnInit(_ctx: StateContext<TStateSlice<FireDocument>>) { /** this.init(); */ }

	private init() {
		this.dbg('init:');
	}

	@Action(memberAction.Set)
	setStore({ getState, setState }: StateContext<TStateSlice<FireDocument>>, { payload, debug }: memberAction.Set) {
		const state = cloneObj(getState()) || {};

		asArray(payload).forEach(doc => {
			doc
			const store = doc[FIELD.Store];

			state[store] = filterState(state, doc);
			state[store].push(doc);							// push the changed MemberDoc into the Store

			if (debug) this.dbg('setMember: %j', doc);
		})

		setState({ ...state });
	}

	@Action(memberAction.Del)
	delStore({ getState, setState }: StateContext<TStateSlice<FireDocument>>, { payload, debug }: memberAction.Del) {
		const state = cloneObj(getState()) || {};
		const segment = FIELD.Store;

		asArray(payload).forEach(doc => {
			const slice = doc[segment];
			state[slice] = filterState(state, doc, segment);

			if (state[slice].length === 0)
				delete state[slice];
			if (debug) this.dbg('delMember: %j', doc);
		})

		setState({ ...state });
	}

	@Action(memberAction.Clear)
	truncStore({ setState }: StateContext<TStateSlice<FireDocument>>, { debug }: memberAction.Clear) {
		if (debug) this.dbg('truncMember');
		setState({});
	}
}