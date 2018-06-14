import { State, Action, StateContext, Selector, NgxsOnInit } from '@ngxs/store';
import { SLICE } from '@state/state.define';
import { IMemberState, IMemberDoc } from '@state/member.define';
import { SetMember, DelMember, TruncMember } from '@state/member.define';

import { FIELD } from '@dbase/fire/fire.define';
import { sortKeys } from '@lib/object.library';
import { dbg } from '@lib/logger.library';

@State<IMemberState>({
	name: SLICE.member,
	defaults: {}
})
export class MemberState implements NgxsOnInit {
	private dbg: Function = dbg.bind(this);

	constructor() { this.dbg('new'); }

	ngxsOnInit(ctx: StateContext<IMemberState>) {
		this.dbg('onInit:');
	}

	@Action(SetMember)
	setClient({ patchState, getState }: StateContext<IMemberState>, { payload }: SetMember) {
		const state = getState() || {};
		const store = this.filterMember(state, payload);

		store.push(payload);										// push the changed MemberDoc into the Store
		state[payload.store] = store;
		this.dbg('setMember: %j', payload);
		patchState({ ...state });
	}

	@Action(DelMember)
	delClient({ patchState, getState }: StateContext<IMemberState>, { payload }: DelMember) {
		const state = getState() || {};
		const store = this.filterMember(getState(), payload);

		state[payload.store] = store;
		this.dbg('delMember: %j', payload);
		patchState({ ...state });
	}

	@Action(TruncMember)
	truncClient({ setState }: StateContext<IMemberState>) {
		this.dbg('truncMember');
		setState({});
	}

	/** remove an item from the Member Store */
	private filterMember(state: IMemberState, payload: IMemberDoc) {
		const curr = state && state[payload.store] || [];

		return [...curr.filter(itm => itm[FIELD.id] !== payload[FIELD.id])];
	}

	/** Selectors */
	@Selector()
	static getMember(store: string, state: any) {
		// TODO: tidy
		const member: IMemberState = state[SLICE.member];
		return [...member[store]
			.filter(itm => !itm[FIELD.expire])
			.filter(itm => !itm[FIELD.hidden])
			.sort(sortKeys(['type', 'order', 'name']))
		];
	}
}