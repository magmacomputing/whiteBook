import { Injectable } from '@angular/core';
import { State, Action, StateContext, NgxsOnInit } from '@ngxs/store';
import { TStateSlice } from '@dbase/state/state.define';
import { IStoreMeta } from '@dbase/data/data.schema';
import { SetMember, DelMember, TruncMember, filterState } from '@dbase/state/state.action';

import { FIELD, COLLECTION } from '@dbase/data/data.define';
import { asArray } from '@lib/array.library';
import { cloneObj } from '@lib/object.library';
import { dbg } from '@lib/logger.library';

@Injectable()
@State<TStateSlice<IStoreMeta>>({
	name: COLLECTION.member,
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
	setStore({ getState, setState }: StateContext<TStateSlice<IStoreMeta>>, { payload, debug }: SetMember) {
		const state = cloneObj(getState()) || {};

		asArray(payload).forEach(doc => {
			const store = doc[FIELD.store];

			state[store] = filterState(state, doc);
			state[store].push(doc);							// push the changed MemberDoc into the Store

			if (debug) this.dbg('setMember: %j', doc);
		})

		setState({ ...state });
	}

	@Action(DelMember)
	delStore({ getState, setState }: StateContext<TStateSlice<IStoreMeta>>, { payload, debug }: DelMember) {
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

	@Action(TruncMember)
	truncStore({ setState }: StateContext<TStateSlice<IStoreMeta>>, { debug }: TruncMember) {
		if (debug) this.dbg('truncMember');
		setState({});
	}
}