import { State, Action, StateContext, Selector, NgxsOnInit } from '@ngxs/store';
import { SLICE } from '@state/store.define';
import { IStoreState, IStoreDoc } from '@state/store.define';
import { SetMember, DelMember, TruncMember } from '@state/member.define';

import { FIELD } from '@dbase/fire/fire.define';
import { sortKeys } from '@lib/object.library';
import { dbg } from '@lib/logger.library';

@State<IStoreState>({
	name: SLICE.member,
	defaults: {}
})
export class MemberState implements NgxsOnInit {
	private dbg: Function = dbg.bind(this);

	constructor() { this.dbg('new'); }

	ngxsOnInit(ctx: StateContext<IStoreState>) {
		this.dbg('onInit:');
	}

	@Action(SetMember)
	setClient({ patchState, getState }: StateContext<IStoreState>, { payload }: SetMember) {
		const state = getState() || {};
		const store = this.filterMember(state, payload);

		store.push(payload);										// push the changed MemberDoc into the Store
		state[payload.store] = store;
		this.dbg('setMember: %j', payload);
		patchState({ ...state });
	}

	@Action(DelMember)
	delClient({ patchState, getState }: StateContext<IStoreState>, { payload }: DelMember) {
		const state = getState() || {};
		const store = this.filterMember(getState(), payload);

		state[payload.store] = store;
		this.dbg('delMember: %j', payload);
		patchState({ ...state });
	}

	@Action(TruncMember)
	truncClient({ setState }: StateContext<IStoreState>) {
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
			.sort(sortKeys(['type', 'order', 'name']))
		];
	}

	/** Member's current plan */
	@Selector()
	static plan(state: IStoreState) {
		return [...state['profile']
			.filter(itm => itm[FIELD.type] === 'plan')
			.filter(itm => !itm[FIELD.expire])
			.filter(itm => !itm[FIELD.hidden])
			.sort(sortKeys(['plan']))
		];
	}
}