import { Injectable } from '@angular/core';
import { State, Action, StateContext, NgxsOnInit, Store } from '@ngxs/store';

import { clientAction, filterState } from '@dbase/state/state.action';
import { TStateSlice } from '@dbase/state/state.define';

import { outline } from '@dbase/state/config.define';
import { setSchema, setConfig } from '@dbase/state/config.library';
import { COLLECTION, STORE, FIELD } from '@dbase/data.define';
import type { FireDocument, Schema, Config } from '@dbase/data.schema';

import { asArray } from '@library/array.library';
import { cloneObj } from '@library/object.library';
import { isEmpty } from '@library/type.library';
import { dbg } from '@library/logger.library';

@Injectable()
@State<TStateSlice<FireDocument>>({
	name: COLLECTION.Client,
	defaults: {}
})
export class ClientState implements NgxsOnInit {
	private dbg = dbg(this);

	constructor(private readonly store: Store) { /** this.init(); */ }

	ngxsOnInit(_ctx: StateContext<TStateSlice<FireDocument>>) { this.init(); }

	private init() {
		this.dbg('init:');
		this.store.selectOnce(state => state[COLLECTION.Client])
			.toPromise()
			.then(client => {
				setSchema(client && client[STORE.Schema]);				// initial load of STORES / SORTBY / FILTER
				setConfig(client && client[STORE.Config]);				// initial load of COMMENT
			})
	}

	@Action(clientAction.Set)
	setStore({ getState, setState }: StateContext<TStateSlice<FireDocument>>, { payload, debug }: clientAction.Set) {
		const state = cloneObj(getState()) || {};
		const schema: FireDocument[] = [];
		const config: FireDocument[] = [];

		asArray(payload).forEach(doc => {
			const store = doc[FIELD.Store];
			state[store] = filterState(state, doc);
			state[store].push(doc);															// push the new/changed ClientDoc into the Store

			if (doc[FIELD.Store] === STORE.Schema && (debug || isEmpty(outline.SLICES)))
				schema.push(doc);																	// if STORE.schema changes, rebuild schema-variables
			if (doc[FIELD.Store] === STORE.Config && (debug || isEmpty(outline.COMMENTS)))
				config.push(doc);

			if (debug) this.dbg('setClient: %s, %j', doc[FIELD.Store], doc);
		})

		if (schema.length)
			setSchema(state[STORE.Schema] as Schema[]);					// rebuild STORES / SORTBY / FILTER
		if (config.length)
			setConfig(state[STORE.Config] as Config[]);					// rebuild COMMENTS
		setState({ ...state });
	}

	@Action(clientAction.Del)
	delStore({ getState, setState }: StateContext<TStateSlice<FireDocument>>, { payload, debug }: clientAction.Del) {
		const state = cloneObj(getState()) || {};
		const schema: FireDocument[] = [];
		const config: FireDocument[] = [];

		asArray(payload).forEach(doc => {
			const store = doc[FIELD.Store];
			state[store] = filterState(state, doc);

			if (state[store].length === 0)
				delete state[doc[FIELD.Store]]
			if (store === STORE.Schema && doc[FIELD.Type] && doc[FIELD.Key])
				schema.push(doc);
			if (store === STORE.Config && doc[FIELD.Type] && doc[FIELD.Key])
				config.push(doc);

			if (debug) this.dbg('delClient: %s, %j', doc[FIELD.Store], doc);
		})

		if (schema.length)
			setSchema(state[STORE.Schema] as Schema[]);					// rebuild the STORES / SORTBY / FILTER
		if (config.length)
			setConfig(state[STORE.Config] as Config[]);					// rebuild the COMMENT variable
		setState({ ...state });
	}

	@Action(clientAction.Clear)
	clearStore({ setState }: StateContext<TStateSlice<FireDocument>>, { debug }: clientAction.Clear) {
		if (debug) this.dbg('clearClient');
		setState({});
	}
}