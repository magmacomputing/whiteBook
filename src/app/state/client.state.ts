import { State, Action, StateContext, Selector } from '@ngxs/store';
import { SetClient, DelClient } from '@app/state/client.action';

import { FIELD } from '@app/dbase/fire/fire.define';

import { dbg } from '@lib/log.library';

export interface IClientDoc {
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
	name: 'client'
})
export class ClientState {
	private dbg: Function = dbg.bind(this);

	@Action(SetClient)
	setClient({ setState }: StateContext<IClientState>, { payload }: SetClient) {
		this.dbg('setClient: %j', payload);
		// setState({ claims: payload });
	}

	@Action(DelClient)
	delClient({ patchState }: StateContext<IClientState>, { payload }: DelClient) {
		this.dbg('delClient: %j', payload);
	}
}