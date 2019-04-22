import { State, Action, StateContext, NgxsOnInit } from '@ngxs/store';
import { TStateSlice, SLICE } from '@dbase/state/state.define';
import { SetMigrate, DelMigrate, TruncMigrate } from '@dbase/state/state.action';

import { IStoreMeta } from '@dbase/data/data.schema';
import { FIELD } from '@dbase/data/data.define';
import { dbg } from '@lib/logger.library';

@State<TStateSlice<IStoreMeta>>({
	name: SLICE.migrate,
	defaults: {}
})
export class MigrateState implements NgxsOnInit {
	private dbg = dbg(this);

	constructor() { this.init(); }

	ngxsOnInit(_ctx: StateContext<TStateSlice<IStoreMeta>>) { this.init(); }

	private init() {
		this.dbg('init:');
	}

	@Action(SetMigrate)
	setStore({ patchState, getState, dispatch }: StateContext<TStateSlice<IStoreMeta>>, { payload, debug }: SetMigrate) {
		const state = getState() || {};
		const migrate = this.filterMigrate(state, payload);	// remove the doc if it was previously created

		migrate.push(payload);															// push the changed MigrateDoc into the Store
		state[payload.uid] = migrate;
		if (debug) this.dbg('setMigrate: %j', payload);
		patchState({ ...state });
	}

	@Action(DelMigrate)																	// very rare Event
	delStore({ patchState, getState, dispatch }: StateContext<TStateSlice<IStoreMeta>>, { payload, debug }: DelMigrate) {
		const state = getState() || {};
		const migrate = this.filterMigrate(state, payload);

		if (migrate.length === 0)
			delete state[payload.uid]
		else state[payload.uid] = migrate;
		if (debug) this.dbg('delMigrate: %j', payload);
		patchState({ ...state });
	}

	@Action(TruncMigrate)
	truncStore({ setState }: StateContext<TStateSlice<IStoreMeta>>, { debug }: TruncMigrate) {
		if (debug) this.dbg('truncMigrate');
		setState({});
	}

	/** remove an item from the Migrate Store */
	private filterMigrate(state: TStateSlice<IStoreMeta>, payload: IStoreMeta) {
		const curr = state && state[payload.uid] || [];

		return [...curr.filter(itm => itm[FIELD.id] !== payload[FIELD.id])];
	}
}