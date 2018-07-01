import { State, Action, StateContext, Selector, NgxsOnInit } from '@ngxs/store';
import { SLICE } from '@dbase/state/store.define';
import { IStoreState, IStoreDoc } from '@dbase/state/store.define';
import { SetMember, DelMember, TruncMember } from '@dbase/state/store.define';

import { FIELD } from '@dbase/data/data.define';
import { sortKeys } from '@lib/object.library';
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
	@Selector()
	static getMember(store: string, state: any) {
		// TODO: tidy
		const member: IStoreState = state[SLICE.member];
		return [...member[store]
			.filter(itm => !itm[FIELD.expire])
			.filter(itm => !itm[FIELD.hidden])
			.sort(sortKeys('type', 'order', 'name'))
		];
	}

	/** Member's current plan */
	@Selector()
	static plan(state: IStoreState) {
		return [...state['profile']
			.filter(itm => itm[FIELD.type] === 'plan')
			.filter(itm => !itm[FIELD.expire])
			.filter(itm => !itm[FIELD.hidden])
			.sort(sortKeys('plan'))
		];
	}
}