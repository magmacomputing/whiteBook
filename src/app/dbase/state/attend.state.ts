import { State, Action, StateContext, NgxsOnInit } from '@ngxs/store';
import { SLICE, IStoreState, IMemberDoc } from '@dbase/state/store.define';
import { SetAttend, DelAttend, TruncAttend } from '@dbase/state/store.define';

import { FIELD } from '@dbase/data/data.define';
import { dbg } from '@lib/logger.library';

@State<IStoreState<IMemberDoc>>({
	name: SLICE.attend,
	defaults: {}
})
export class AttendState implements NgxsOnInit {
	private dbg: CallableFunction = dbg.bind(this);

	constructor() { }

	ngxsOnInit(_ctx: StateContext<IStoreState<IMemberDoc>>) { this.dbg('init:'); }

	@Action(SetAttend)
	setStore({ patchState, getState }: StateContext<IStoreState<IMemberDoc>>, { payload, debug }: SetAttend) {
		const state = getState() || {};
		const payment = this.filterAttend(state, payload);

		payment.push(payload);										// push the changed AttendDoc into the Store
		state[payload.payment] = payment;
		if (debug) this.dbg('setAttend: %j', payload);
		patchState({ ...state });
	}

	@Action(DelAttend)
	delStore({ patchState, getState }: StateContext<IStoreState<IMemberDoc>>, { payload, debug }: DelAttend) {
		const state = getState() || {};
		const payment = this.filterAttend(state, payload);

		if (payment.length === 0)
			delete state[payload.payment]
		else state[payload.payment] = payment;
		if (debug) this.dbg('delAttend: %j', payload);
		patchState({ ...state });
	}

	@Action(TruncAttend)
	truncStore({ setState }: StateContext<IStoreState<IMemberDoc>>, { debug }: TruncAttend) {
		if (debug) this.dbg('truncAttend');
		setState({});
	}

	/** remove an item from the Attend Store */
	private filterAttend(state: IStoreState<IMemberDoc>, payload: IMemberDoc) {
		const curr = state && state[payload.payment] || [];

		return [...curr.filter(itm => itm[FIELD.id] !== payload[FIELD.id])];
	}
}