import { State, Action, StateContext, NgxsOnInit } from '@ngxs/store';
import { TStateSlice, SLICE } from '@dbase/state/state.define';
import { SetAttend, DelAttend, TruncAttend, SyncAttend } from '@dbase/state/state.action';

import { IStoreMeta } from '@dbase/data/data.schema';
import { FIELD } from '@dbase/data/data.define';
import { dbg } from '@lib/logger.library';
import { asArray } from '@lib/array.library';

@State<TStateSlice<IStoreMeta>>({
	name: SLICE.attend,
	defaults: {}
})
export class AttendState implements NgxsOnInit {
	private dbg = dbg(this);

	constructor() { this.init(); }

	ngxsOnInit(_ctx: StateContext<TStateSlice<IStoreMeta>>) { this.init(); }

	private init() {
		this.dbg('init:');
	}

	@Action(SetAttend)
	setStore({ patchState, getState, dispatch }: StateContext<TStateSlice<IStoreMeta>>, { payload, debug }: SetAttend) {
		const state = getState() || {};

		asArray(payload).forEach(doc => {
			const payment = doc.payment;
			state[payment] = this.filterAttend(state, doc);	// remove the doc if it was previously created
			state[payment].push(doc);												// push the changed AttendDoc into the Store
			if (debug) this.dbg('setAttend: %j', doc);
		})

		patchState({ ...state });
		dispatch(new SyncAttend(payload));								// tell any listener we have sync'd
	}

	@Action(DelAttend)																	// very rare Event
	delStore({ patchState, getState, dispatch }: StateContext<TStateSlice<IStoreMeta>>, { payload, debug }: DelAttend) {
		const state = getState() || {};

		asArray(payload).forEach(doc => {
			const payment = doc.payment;
			state[payment] = this.filterAttend(state, doc);

			if (state[payment].length === 0)
				delete state[doc.payment]

			if (debug) this.dbg('delAttend: %j', doc);
		})

		patchState({ ...state });
		dispatch(new SyncAttend(payload));									// tell any listener we have sync'd
	}

	@Action(TruncAttend)
	truncStore({ setState }: StateContext<TStateSlice<IStoreMeta>>, { debug }: TruncAttend) {
		if (debug) this.dbg('truncAttend');
		setState({});
	}

	/** remove an item from the Attend Store */
	private filterAttend(state: TStateSlice<IStoreMeta>, payload: IStoreMeta) {
		const curr = state && state[payload.payment] || [];

		return [...curr.filter(itm => itm[FIELD.id] !== payload[FIELD.id])];
	}
}