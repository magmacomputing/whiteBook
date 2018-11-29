import { StateContext, NgxsOnInit } from '@ngxs/store';
import { IStoreState, IStoreDoc, IMemberDoc } from '@dbase/state/store.define';
import { SetClient, DelClient } from '@dbase/state/store.define';
import { SetMember, DelMember } from '@dbase/state/store.define';
import { SetAttend, DelAttend } from '@dbase/state/store.define';

import { FIELD } from '@dbase/data/data.define';

import { dbg } from '@lib/logger.library';

export class StoreState implements NgxsOnInit {
	private dbg: CallableFunction = dbg.bind(this);
	private name = this.constructor.name;

	constructor() { this.dbg('new'); }

	ngxsOnInit(_ctx: StateContext<IStoreState<IStoreDoc | IMemberDoc>>) { this.dbg('onInit:'); }

	setStore({ patchState, getState }: StateContext<IStoreState<IStoreDoc | IMemberDoc>>, { payload }: SetClient | SetMember | SetAttend) {
		const state = getState() || {};
		const store = this.filterStore(state, payload);

		store.push(payload);														// push the changed document into the Store
		state[payload.store] = store;
		this.dbg('%s: %j', this.name, payload);
		patchState({ ...state });
	}

	delStore({ patchState, getState }: StateContext<IStoreState<IStoreDoc | IMemberDoc>>, { payload }: DelClient | DelMember | DelAttend) {
		const state = getState() || {};
		const store = this.filterStore(getState(), payload);

		state[payload.store] = store;
		this.dbg('%s: %j', this.name, payload);
		patchState({ ...state });
	}

	truncStore({ setState }: StateContext<IStoreState<IStoreDoc | IMemberDoc>>) {
		this.dbg('%s', this.name);
		setState({});
	}

	/** remove an item from the Client Store */
	private filterStore(state: IStoreState<IStoreDoc | IMemberDoc>, payload: IStoreDoc | IMemberDoc) {
		const curr = state && state[payload.store] || [];

		return [...curr.filter(itm => itm[FIELD.id] !== payload[FIELD.id])];
	}
}
