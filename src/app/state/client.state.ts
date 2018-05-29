import { State, Action, StateContext, Selector, NgxsOnInit } from '@ngxs/store';
import { SLICE } from '@state/state.define';
import { IClientState, IClientDoc } from '@state/client.define';
import { SetClient, DelClient, TruncClient } from '@state/client.define';

import { FIELD } from '@dbase/fire/fire.define';
import { dbg } from '@lib/logger.library';

@State<IClientState>({
	name: SLICE.client,
	defaults: {}
})
export class ClientState implements NgxsOnInit {
	private dbg: Function = dbg.bind(this);

	constructor() { this.dbg('new'); }

  ngxsOnInit(ctx: StateContext<IClientState>) {		// TODO: why this does not fire?
		// ctx.dispatch(new CheckSession());
		this.dbg('onInit:');
	}

	@Action(SetClient)
	setClient({ patchState, getState, setState }: StateContext<IClientState>, { payload }: SetClient) {
		const state = getState() || {};
		const store = this.filterClient(state, payload);

		store.push(payload);										// push the changed ClientDoc into the Store
		state[payload.store] = store;
		patchState({ ...state });
	}

	@Action(DelClient)
	delClient({ patchState, getState }: StateContext<IClientState>, { payload }: DelClient) {
		const state = getState() || {};
		const store = this.filterClient(getState(), payload);

		state[payload.store] = store;
		this.dbg('delClient: %j', payload);
		patchState({ ...state });
	}

	@Action(TruncClient)
	truncClient({ setState }: StateContext<IClientState>) {
		this.dbg('truncClient');
		setState({});
	}

	/** remove an item from the Client Store */
	private filterClient(state: IClientState, payload: IClientDoc) {
		const curr = state && state[payload.store] || [];

		return [...curr.filter(itm => itm[FIELD.id] !== payload[FIELD.id])];
	}

	/** Selectors */
	@Selector()
	static providers(state: IClientState) {
		return [...state['provider'].filter(itm => !itm[FIELD.expire])];
	}
}