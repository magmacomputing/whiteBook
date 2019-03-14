import { State, Action, StateContext, NgxsOnInit } from '@ngxs/store';
import { TStateSlice, SLICE } from '@dbase/state/state.define';
import { SetAttend, DelAttend, TruncAttend, NewAttend } from '@dbase/state/state.action';

import { FIELD } from '@dbase/data/data.define';
import { dbg } from '@lib/logger.library';
import { IStoreMeta } from '@dbase/data/data.schema';

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
		const attend = this.filterAttend(state, payload);	// remove the doc if it was previously created

		attend.push(payload);															// push the changed AttendDoc into the Store
		state[payload.payment] = attend;
		if (debug) this.dbg('setAttend: %j', payload);
		patchState({ ...state });
		dispatch(new NewAttend(payload));									// tell any listener we have sync'd
	}

	@Action(DelAttend)
	delStore({ patchState, getState }: StateContext<TStateSlice<IStoreMeta>>, { payload, debug }: DelAttend) {
		const state = getState() || {};
		const attend = this.filterAttend(state, payload);

		if (attend.length === 0)
			delete state[payload.payment]
		else state[payload.payment] = attend;
		if (debug) this.dbg('delAttend: %j', payload);
		patchState({ ...state });
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