import { State, Action, StateContext, NgxsOnInit, createSelector } from '@ngxs/store';
import { SLICE } from '@dbase/state/store.define';
import { IStoreState, IStoreDoc } from '@dbase/state/store.define';
import { SetMember, DelMember, TruncMember } from '@dbase/state/store.define';

import { filterTable } from '@dbase/app/app.library';
import { TWhere } from '@dbase/fire/fire.interface';
import { FIELD } from '@dbase/data/data.define';

import { TString } from '@lib/type.library';
import { cloneObj, sortKeys } from '@lib/object.library';
import { asArray } from '@lib/array.library';
import { dbg } from '@lib/logger.library';

@State<IStoreState<IStoreDoc>>({
	name: SLICE.member,
	defaults: {}
})
export class MemberState implements NgxsOnInit {
	private dbg: Function = dbg.bind(this);

	constructor() { }

	ngxsOnInit(_ctx: StateContext<IStoreState<IStoreDoc>>) { this.dbg('init:'); }

	@Action(SetMember)
	setStore({ patchState, getState }: StateContext<IStoreState<IStoreDoc>>, { payload, debug }: SetMember) {
		const state = getState() || {};
		const store = this.filterMember(state, payload);

		store.push(payload);										// push the changed MemberDoc into the Store
		state[payload.store] = store;
		if (debug) this.dbg('setMember: %j', payload);
		patchState({ ...state });
	}

	@Action(DelMember)
	delStore({ patchState, getState }: StateContext<IStoreState<IStoreDoc>>, { payload, debug }: DelMember) {
		const state = getState() || {};
		const store = this.filterMember(getState(), payload);

		state[payload.store] = store;
		if (debug) this.dbg('delMember: %j', payload);
		patchState({ ...state });
	}

	@Action(TruncMember)
	truncStore({ setState }: StateContext<IStoreState<IStoreDoc>>, { debug }: TruncMember) {
		if (debug) this.dbg('truncMember');
		setState({});
	}

	/** remove an item from the Member Store */
	private filterMember(state: IStoreState<IStoreDoc>, payload: IStoreDoc) {
		const curr = state && state[payload.store] || [];

		return [...curr.filter(itm => itm[FIELD.id] !== payload[FIELD.id])];
	}

	/** Selectors */
	static current(store: string, filter: TWhere | undefined, sortBy: TString = []) {
		return createSelector([MemberState], (state: IStoreState<IStoreDoc>) => {
			const clone = cloneObj(state[store]);							// clone to avoid mutating original Store
			const filters = asArray(filter);

			filters.push({ fieldPath: FIELD.expire, value: 0 });
			filters.push({ fieldPath: FIELD.hidden, value: false });

			return clone
				? filterTable(clone, filters)
					.sort(sortKeys(...asArray(sortBy)))						// apply any requested sort-criteria
				: []
		})
	}
}