import { State, Action, StateContext, NgxsOnInit } from '@ngxs/store';
import { TStateSlice } from '@dbase/state/state.define';
import { SLICE, SetAttend, DelAttend, TruncAttend } from '@dbase/state/state.action';

import { FIELD } from '@dbase/data/data.define';
import { dbg } from '@lib/logger.library';
import { IStoreMeta } from '@dbase/data/data.schema';

@State<TStateSlice<IStoreMeta>>({
	name: SLICE.attend,
	defaults: {}
})
export class AttendState implements NgxsOnInit {
	private dbg = dbg(this);

	constructor() { }

	ngxsOnInit(_ctx: StateContext<TStateSlice<IStoreMeta>>) { this.dbg('init:'); }

	@Action(SetAttend)
	setStore({ patchState, getState }: StateContext<TStateSlice<IStoreMeta>>, { payload, debug }: SetAttend) {
		const state = getState() || {};
		const payment = this.filterAttend(state, payload);

		payment.push(payload);										// push the changed AttendDoc into the Store
		state[payload.payment] = payment;
		if (debug) this.dbg('setAttend: %j', payload);
		patchState({ ...state });
	}

	@Action(DelAttend)
	delStore({ patchState, getState }: StateContext<TStateSlice<IStoreMeta>>, { payload, debug }: DelAttend) {
		const state = getState() || {};
		const payment = this.filterAttend(state, payload);

		if (payment.length === 0)
			delete state[payload.payment]
		else state[payload.payment] = payment;
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