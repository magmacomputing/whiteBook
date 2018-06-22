import { State, Action, StateContext, Selector, NgxsOnInit } from '@ngxs/store';
import { SLICE } from '@state/state.define';
import { IAttendState, IAttendDoc } from '@state/attend.define';
import { SetAttend, DelAttend, TruncAttend } from '@state/attend.define';

import { FIELD } from '@dbase/fire/fire.define';
import { sortKeys } from '@lib/object.library';
import { dbg } from '@lib/logger.library';

@State<IAttendState>({
	name: SLICE.attend,
	defaults: {}
})
export class AttendState implements NgxsOnInit {
	private dbg: Function = dbg.bind(this);

	constructor() { this.dbg('new'); }

	ngxsOnInit(_ctx: StateContext<IAttendState>) {
		this.dbg('onInit:');
	}

	@Action(SetAttend)
	setClient({ patchState, getState }: StateContext<IAttendState>, { payload }: SetAttend) {
		const state = getState() || {};
		const store = this.filterAttend(state, payload);

		store.push(payload);										// push the changed AttendDoc into the Store
		state[payload.store] = store;
		this.dbg('setAttend: %j', payload);
		patchState({ ...state });
	}

	@Action(DelAttend)
	delClient({ patchState, getState }: StateContext<IAttendState>, { payload }: DelAttend) {
		const state = getState() || {};
		const store = this.filterAttend(getState(), payload);

		state[payload.store] = store;
		this.dbg('delAttend: %j', payload);
		patchState({ ...state });
	}

	@Action(TruncAttend)
	truncClient({ setState }: StateContext<IAttendState>) {
		this.dbg('truncAttend');
		setState({});
	}

	/** remove an item from the Attend Store */
	private filterAttend(state: IAttendState, payload: IAttendDoc) {
		const curr = state && state[payload.store] || [];

		return [...curr.filter(itm => itm[FIELD.id] !== payload[FIELD.id])];
	}

	/** Selectors */
	@Selector()
	static getAttend(store: string, state: any) {
		// TODO: tidy
		const attend: IAttendState = state[SLICE.attend];
		return [...attend[store]
			.filter(itm => !itm[FIELD.expire])
			.filter(itm => !itm[FIELD.hidden])
			.sort(sortKeys(['type', 'order', 'name']))
		];
	}
}