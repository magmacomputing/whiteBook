import { State, Action, StateContext, Selector } from '@ngxs/store';
import { SetClient, DelClient } from '@app/state/client.action';

import { FIELD } from '@app/dbase/fire/fire.define';

import { dbg } from '@lib/log.library';

export const ClientSlice = 'client';

export interface IClientDoc {
	[FIELD.id]: string;
	store: string;
	[key: string]: any;
}
export interface IClientState {
	[store: string]: IClientDoc[];
}

/**
 * The 'client' state contains a copy of the remote /client Collection,
 * separated into distinct 'store' objects.
 * For example:
 * client: {
 * 		class: [ {class documents} ],
 *  	price: [ {price documents} ],
 * 		...
 * 	}
 */
@State<IClientState>({
	name: ClientSlice,
	defaults: {}
})
export class ClientState {
	private dbg: Function = dbg.bind(this);

	@Action(SetClient)
	setClient({ patchState, getState }: StateContext<IClientState>, { payload }: SetClient) {
		const state = getState() || {};
		const store = this.filterClient(state, payload);

		store.push(payload);										// push the changed ClientDoc into the Store
		state[payload.store] = store;
		this.dbg('setClient: %j', payload);
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

	/** remove an item from the Client Store */
	private filterClient(state: IClientState, payload: IClientDoc) {
		const curr = state && state[payload.store] || [];

		return curr.filter(itm => itm[FIELD.id] !== payload[FIELD.id]);
	}
}