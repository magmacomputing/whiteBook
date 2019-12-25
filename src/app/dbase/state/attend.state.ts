import { State, Action, StateContext, NgxsOnInit } from '@ngxs/store';
import { TStateSlice } from '@dbase/state/state.define';
import { SetAttend, DelAttend, TruncAttend, SyncAttend } from '@dbase/state/state.action';

import { IStoreMeta } from '@dbase/data/data.schema';
import { FIELD, COLLECTION } from '@dbase/data/data.define';
import { asArray } from '@lib/array.library';
import { cloneObj } from '@lib/object.library';
import { dbg } from '@lib/logger.library';

@State<TStateSlice<IStoreMeta>>({
	name: COLLECTION.attend,
	defaults: {}
})
export class AttendState implements NgxsOnInit {
	private dbg = dbg(this);

	constructor() { this.init(); }

	ngxsOnInit(_ctx: StateContext<TStateSlice<IStoreMeta>>) { /** this.init(); */ }

	private init() {
		this.dbg('init:');
	}

	@Action(SetAttend)
	setStore({ getState, setState, dispatch }: StateContext<TStateSlice<IStoreMeta>>, { payload, debug }: SetAttend) {
		const state = cloneObj(getState()) || {};
		let empty: { [segment: string]: boolean; } = {};

		asArray(payload).forEach(doc => {
			const payment = doc.payment[FIELD.id];

			if (state[payment] && !state[payment].length)
				empty[payment] = true;							// check the first instance
			if (!empty[payment])									// dont bother with filter, if originally empty
				state[payment] = this.filterState(state, doc);	// remove the doc if it was previously created
			state[payment].push(doc);												// push the changed AttendDoc into the Store

			if (debug) this.dbg('setAttend: %j', doc);
		})

		setState({ ...state });
		dispatch(new SyncAttend(payload));								// tell any listener we have sync'd
	}

	@Action(DelAttend)																	// very rare Event
	delStore({ getState, setState, dispatch }: StateContext<TStateSlice<IStoreMeta>>, { payload, debug }: DelAttend) {
		const state = cloneObj(getState()) || {};

		asArray(payload).forEach(doc => {
			const payment = doc.payment[FIELD.id];
			state[payment] = this.filterState(state, doc);

			if (state[payment].length === 0)
				delete state[payment];

			if (debug) this.dbg('delAttend: %j', doc);
		})

		setState({ ...state });
		dispatch(new SyncAttend(payload));									// tell any listener we have sync'd
	}

	@Action(TruncAttend)
	truncStore({ setState }: StateContext<TStateSlice<IStoreMeta>>, { debug }: TruncAttend) {
		if (debug) this.dbg('truncAttend');
		setState({});
	}

	/** remove an item from the Attend Store */
	private filterState(state: TStateSlice<IStoreMeta>, payload: IStoreMeta) {
		const slice = payload.payment[FIELD.id];
		const curr = state && slice && state[slice] || [];

		return [...curr.filter(itm => itm[FIELD.id] !== payload[FIELD.id])];
	}
}