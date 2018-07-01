import { State, Action, StateContext, Selector, NgxsOnInit } from '@ngxs/store';
import { SLICE, IStoreState, IStoreDoc } from '@dbase/state/store.define';
import { SetClient, DelClient, TruncClient } from '@dbase/state/store.define';

import { FIELD } from '@dbase/data/data.define';
import { sortKeys } from '@lib/object.library';
import { dbg } from '@lib/logger.library';

@State<IStoreState>({
	name: SLICE.client,
	defaults: {}
})
export class ClientState implements NgxsOnInit {
	private dbg: Function = dbg.bind(this);

	constructor() { }

	ngxsOnInit(_ctx: StateContext<IStoreState>) { this.dbg('init:'); }

	@Action(SetClient)
	setStore({ patchState, getState }: StateContext<IStoreState>, { payload }: SetClient) {
		const state = getState() || {};
		const store = this.filterClient(state, payload);

		store.push(payload);										// push the changed ClientDoc into the Store
		state[payload.store] = store;
		this.dbg('setClient: %j', payload);
		patchState({ ...state });
	}

	@Action(DelClient)
	delStore({ patchState, getState }: StateContext<IStoreState>, { payload }: DelClient) {
		const state = getState() || {};
		const store = this.filterClient(getState(), payload);

		state[payload.store] = store;
		this.dbg('delClient: %j', payload);
		patchState({ ...state });
	}

	@Action(TruncClient)
	truncStore({ setState }: StateContext<IStoreState>) {
		this.dbg('truncClient');
		setState({});
	}

	/** remove an item from the Client Store */
	private filterClient(state: IStoreState, payload: IStoreDoc) {
		const curr = state && state[payload.store] || [];

		return [...curr.filter(itm => itm[FIELD.id] !== payload[FIELD.id])];
	}

	/** Selectors */
	@Selector()
	static getClient(state: IStoreState) {
		return (store: string, type?: string, ...keys: any[]) => {
			return [...state[store]
				.filter(itm => type ? itm[FIELD.type] === type : itm)
				.filter(itm => !itm[FIELD.expire])
				.filter(itm => !itm[FIELD.hidden])
				.sort(sortKeys(...keys))
			]
		}
	}
}