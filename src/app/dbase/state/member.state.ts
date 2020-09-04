import { Injectable } from '@angular/core';
import { State, Action, StateContext, NgxsOnInit } from '@ngxs/store';

import { TStateSlice } from '@dbase/state/state.define';
import { StoreMeta } from '@dbase/data/data.schema';
import { MemberAction, filterState } from '@dbase/state/state.action';

import { FIELD, COLLECTION } from '@dbase/data/data.define';
import { asArray } from '@library/array.library';
import { cloneObj } from '@library/object.library';
import { dbg } from '@library/logger.library';

@Injectable()
@State<TStateSlice<StoreMeta>>({
	name: COLLECTION.member,
	defaults: {}
})
export class MemberState implements NgxsOnInit {
	private dbg = dbg(this);

	constructor() { this.init(); }

	ngxsOnInit(_ctx: StateContext<TStateSlice<StoreMeta>>) { /** this.init(); */ }

	private init() {
		this.dbg('init:');
	}

	@Action(MemberAction.Set)
	setStore({ getState, setState }: StateContext<TStateSlice<StoreMeta>>, { payload, debug }: MemberAction.Set) {
		const state = cloneObj(getState()) || {};

		asArray(payload).forEach(doc => {
			doc
			const store = doc[FIELD.store];

			state[store] = filterState(state, doc);
			state[store].push(doc);							// push the changed MemberDoc into the Store

			if (debug) this.dbg('setMember: %j', doc);
		})

		setState({ ...state });
	}

	@Action(MemberAction.Del)
	delStore({ getState, setState }: StateContext<TStateSlice<StoreMeta>>, { payload, debug }: MemberAction.Del) {
		const state = cloneObj(getState()) || {};
		const segment = FIELD.store;

		asArray(payload).forEach(doc => {
			const slice = doc[segment];
			state[slice] = filterState(state, doc, segment);

			if (state[slice].length === 0)
				delete state[slice];
			if (debug) this.dbg('delMember: %j', doc);
		})

		setState({ ...state });
	}

	@Action(MemberAction.Trunc)
	truncStore({ setState }: StateContext<TStateSlice<StoreMeta>>, { debug }: MemberAction.Trunc) {
		if (debug) this.dbg('truncMember');
		setState({});
	}
}