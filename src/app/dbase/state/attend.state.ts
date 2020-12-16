import { Injectable } from '@angular/core';
import { State, Action, StateContext, NgxsOnInit } from '@ngxs/store';

import type { TStateSlice } from '@dbase/state/state.define';
import type { Attend, FireDocument } from '@dbase/data.schema';
import { attendAction } from '@dbase/state/state.action';
import { FIELD, COLLECTION } from '@dbase/data.define';

import { asArray } from '@library/array.library';
import { cloneObj } from '@library/object.library';
import { dbg } from '@library/logger.library';

@Injectable()
@State<TStateSlice<FireDocument>>({
	name: COLLECTION.Attend,
	defaults: {}
})
export class AttendState implements NgxsOnInit {
	private dbg = dbg(this);

	constructor() { this.init(); }

	ngxsOnInit(_ctx: StateContext<TStateSlice<FireDocument>>) { /** this.init(); */ }

	private init() {
		this.dbg('init:');
	}

	@Action(attendAction.Set)
	setStore({ getState, setState, dispatch }: StateContext<TStateSlice<FireDocument>>, { payload, debug }: attendAction.Set) {
		const state = cloneObj(getState()) || {};
		let empty: Record<string, boolean> = {};

		asArray<Attend>(payload as Attend[]).forEach(doc => {
			const payment = doc.payment[FIELD.Id];

			if (state[payment] && !state[payment].length)
				empty[payment] = true;															// check the first instance
			if (!empty[payment])																	// dont bother with filter, if originally empty
				state[payment] = this.filterState(state, doc);			// remove the doc if it was previously created
			state[payment].push(doc);															// push the changed AttendDoc into the Store

			if (debug) this.dbg('setAttend: %j', doc);
		})

		setState({ ...state });
		dispatch(new attendAction.Sync(payload));								// tell any listener we have sync'd
	}

	@Action(attendAction.Del)																	// very rare Event
	delStore({ getState, setState, dispatch }: StateContext<TStateSlice<FireDocument>>, { payload, debug }: attendAction.Del) {
		const state = cloneObj(getState()) || {};

		asArray(payload as Attend[]).forEach(doc => {
			const payment = doc.payment[FIELD.Id];
			state[payment] = this.filterState(state, doc);

			if (state[payment].length === 0)
				delete state[payment];

			if (debug) this.dbg('delAttend: %j', doc);
		})

		setState({ ...state });
		dispatch(new attendAction.Sync(payload));								// tell any listener we have sync'd
	}

	@Action(attendAction.Clear)
	truncStore({ setState }: StateContext<TStateSlice<FireDocument>>, { debug }: attendAction.Clear) {
		if (debug) this.dbg('truncAttend');
		setState({});
	}

	/** remove an item from the Attend Store */
	private filterState(state: TStateSlice<FireDocument>, payload: Attend) {
		const slice = payload.payment[FIELD.Id];
		const curr = state && slice && state[slice] || [];

		return [...curr.filter(itm => itm[FIELD.Id] !== payload[FIELD.Id])];
	}
}