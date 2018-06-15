import { State, Action, StateContext, Selector, NgxsOnInit } from '@ngxs/store';
import { SLICE } from '@state/state.define';
import { IStoreState, IStoreDoc } from '@state/store.define';
import { SetStore, DelStore, TruncStore } from '@state/store.define';

import { FIELD } from '@dbase/fire/fire.define';
import { sortKeys } from '@lib/object.library';
import { dbg } from '@lib/logger.library';

@State<IStoreState>({
	name: SLICE.client,
	defaults: {}
})
export class ClientState implements NgxsOnInit {
	private dbg: Function = dbg.bind(this);

	constructor() { this.dbg('new'); }

	ngxsOnInit(ctx: StateContext<IStoreState>) {
		this.dbg('onInit:');
	}

	@Action(SetStore)
	setStore({ patchState, getState }: StateContext<IStoreState>, { payload }: SetStore) {
		const state = getState() || {};
		const store = this.filterClient(state, payload);

		store.push(payload);										// push the changed ClientDoc into the Store
		state[payload.store] = store;
		this.dbg('setStore: %j', payload);
		patchState({ ...state });
	}

	@Action(DelStore)
	delStore({ patchState, getState }: StateContext<IStoreState>, { payload }: DelStore) {
		const state = getState() || {};
		const store = this.filterClient(getState(), payload);

		state[payload.store] = store;
		this.dbg('delStore: %j', payload);
		patchState({ ...state });
	}

	@Action(TruncStore)
	truncStore({ setState }: StateContext<IStoreState>) {
		this.dbg('truncStore');
		setState({});
	}

	/** remove an item from the Client Store */
	private filterClient(state: IStoreState, payload: IStoreDoc) {
		const curr = state && state[payload.store] || [];

		return [...curr.filter(itm => itm[FIELD.id] !== payload[FIELD.id])];
	}

	/** Selectors */
	@Selector()
	static providers(state: IStoreState) {
		return [...state['provider']
			.filter(itm => !itm[FIELD.expire])
			.filter(itm => !itm[FIELD.hidden])
			.sort(sortKeys(['type', 'order', 'name']))
		];
	}

	@Selector()
	static getClient(store: string, state: any) {
		// TODO: tidy
		const client: IStoreState = state[SLICE.client];
		return [...client[store]
			.filter(itm => !itm[FIELD.expire])
			.filter(itm => !itm[FIELD.hidden])
			.sort(sortKeys(['type', 'order', 'name']))
		];
	}
}