import { State, Action, StateContext, Selector, NgxsOnInit } from '@ngxs/store';
import { SLICE } from '@dbase/state/store.define';
import { IStoreState, IStoreDoc } from '@dbase/state/store.define';
import { SetMember, DelMember, TruncMember } from '@dbase/state/store.define';
import { currStore } from '@dbase/state/store.state';

import { FIELD } from '@dbase/data/data.define';
import { dbg } from '@lib/logger.library';

@State<IStoreState>({
	name: SLICE.member,
	defaults: {}
})
export class MemberState implements NgxsOnInit {
	private dbg: Function = dbg.bind(this);

	constructor() { }

	ngxsOnInit(_ctx: StateContext<IStoreState>) { this.dbg('init:'); }

	@Action(SetMember)
	setStore({ patchState, getState }: StateContext<IStoreState>, { payload }: SetMember) {
		const state = getState() || {};
		const store = this.filterMember(state, payload);

		store.push(payload);										// push the changed MemberDoc into the Store
		state[payload.store] = store;
		this.dbg('setMember: %j', payload);
		patchState({ ...state });
	}

	@Action(DelMember)
	delStore({ patchState, getState }: StateContext<IStoreState>, { payload }: DelMember) {
		const state = getState() || {};
		const store = this.filterMember(getState(), payload);

		state[payload.store] = store;
		this.dbg('delMember: %j', payload);
		patchState({ ...state });
	}

	@Action(TruncMember)
	truncStore({ setState }: StateContext<IStoreState>) {
		this.dbg('truncMember');
		setState({});
	}

	/** remove an item from the Member Store */
	private filterMember(state: IStoreState, payload: IStoreDoc) {
		const curr = state && state[payload.store] || [];

		return [...curr.filter(itm => itm[FIELD.id] !== payload[FIELD.id])];
	}

	/** Selectors */
	@Selector()											/** Get current (un-expired) documents */
	static getMember(state: IStoreState) {
		return currStore.bind(this, state);
	}
}