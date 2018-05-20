import { State, Action, StateContext, Selector } from '@ngxs/store';
import { SetClient, DelClient } from '@app/state/client.action';

import { FIELD } from '@app/dbase/fire/fire.define';

import { dbg } from '@lib/log.library';

export interface IClientSlice {
	[FIELD.id]: string;
	store: string;
	[name: string]: any;
}
export interface IClientState {
	store: [IClientSlice]
}

@State<IClientState>({
	name: 'client',
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