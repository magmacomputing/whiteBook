import { State, Action, StateContext, Selector, NgxsOnInit } from '@ngxs/store';
import { SLICE, IStoreState, IStoreDoc } from '@dbase/state/store.define';
import { SetAttend, DelAttend, TruncAttend } from '@dbase/state/store.define';

import { FIELD } from '@dbase/data/data.define';
import { sortKeys } from '@lib/object.library';
import { dbg } from '@lib/logger.library';

@State<IStoreState>({
	name: SLICE.attend,
	defaults: {}
})
export class AttendState implements NgxsOnInit {
	private dbg: Function = dbg.bind(this);

	constructor() { }

	ngxsOnInit(_ctx: StateContext<IStoreState>) { this.dbg('init:'); }

	@Action(SetAttend)
	setStore({ patchState, getState }: StateContext<IStoreState>, { payload, debug }: SetAttend) {
		const state = getState() || {};
		const store = this.filterAttend(state, payload);

		store.push(payload);										// push the changed AttendDoc into the Store
		state[payload.store] = store;
		if (debug) this.dbg('setAttend: %j', payload);
		patchState({ ...state });
	}

	@Action(DelAttend)
	delStore({ patchState, getState }: StateContext<IStoreState>, { payload, debug }: DelAttend) {
		const state = getState() || {};
		const store = this.filterAttend(getState(), payload);

		state[payload.store] = store;
		if (debug) this.dbg('delAttend: %j', payload);
		patchState({ ...state });
	}

	@Action(TruncAttend)
	truncStore({ setState }: StateContext<IStoreState>) {
		this.dbg('truncAttend');
		setState({});
	}

	/** remove an item from the Attend Store */
	private filterAttend(state: IStoreState, payload: IStoreDoc) {
		const curr = state && state[payload.store] || [];

		return [...curr.filter(itm => itm[FIELD.id] !== payload[FIELD.id])];
	}

	/** Selectors */
	@Selector()
	static getAttend(store: string, state: any) {
		const attend: IStoreState = state[SLICE.attend];
		return [...attend[store]
			.filter(itm => !itm[FIELD.expire])
			.filter(itm => !itm[FIELD.hidden])
			.sort(sortKeys('type', 'order', 'name'))
		];
	}
}