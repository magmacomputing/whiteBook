import { Injectable } from '@angular/core';
import { State, Action, StateContext, NgxsOnInit, Store } from '@ngxs/store';
import { ClientAction, filterState } from '@dbase/state/state.action';
import { TStateSlice } from '@dbase/state/state.define';

import { SLICES, COMMENT } from '@dbase/state/config.define';
import { setSchema, setConfig } from '@dbase/state/config.library';
import { STORE, FIELD, COLLECTION } from '@dbase/data/data.define';
import { StoreMeta, Schema, Config } from '@dbase/data/data.schema';

import { asArray } from '@library/array.library';
import { cloneObj } from '@library/object.library';
import { isEmpty } from '@library/type.library';
import { dbg } from '@library/logger.library';
import { tap } from 'rxjs/operators';

@Injectable()
@State<TStateSlice<StoreMeta>>({
	name: COLLECTION.client,
	defaults: {}
})
export class ClientState implements NgxsOnInit {
	private dbg = dbg(this);

	constructor(private readonly store: Store) { this.init(); }

	ngxsOnInit(_ctx: StateContext<TStateSlice<StoreMeta>>) { /** this.init(); */ }

	private init() {
		this.dbg('init:');
		this.store.selectOnce(state => state[COLLECTION.client])
			.toPromise()
			.then(client => {
				setSchema(client && client[STORE.schema]);				// initial load of STORES / SORTBY / FILTER
				setConfig(client && client[STORE.config]);				// initial load of COMMENT
			})
	}

	@Action(ClientAction.Set)
	setStore({ getState, setState }: StateContext<TStateSlice<StoreMeta>>, { payload, debug }: ClientAction.Set) {
		const state = cloneObj(getState()) || {};
		const schema: StoreMeta[] = [];
		const config: StoreMeta[] = [];

		asArray(payload).forEach(doc => {
			const store = doc[FIELD.store];
			state[store] = filterState(state, doc);
			state[store].push(doc);									// push the new/changed ClientDoc into the Store

			if (doc[FIELD.store] === STORE.schema && (debug || isEmpty<object>(SLICES)))
				schema.push(doc);											// if STORE.schema changes, rebuild schema-variables
			if (doc[FIELD.store] === STORE.config && (debug || isEmpty<object>(COMMENT)))
				config.push(doc);

			if (debug) this.dbg('setClient: %s, %j', doc[FIELD.store], doc);
		})

		if (schema.length)
			setSchema(state[STORE.schema] as Schema[]);	// rebuild the STORES / SORTBY / FILTER
		if (config.length)
			setConfig(state[STORE.config] as Config[]);
		setState({ ...state });
	}

	@Action(ClientAction.Del)
	delStore({ getState, setState }: StateContext<TStateSlice<StoreMeta>>, { payload, debug }: ClientAction.Del) {
		const state = cloneObj(getState()) || {};
		const schema: StoreMeta[] = [];
		const config: StoreMeta[] = [];

		asArray(payload).forEach(doc => {
			const store = doc[FIELD.store];
			state[store] = filterState(state, doc);

			if (state[store].length === 0)
				delete state[doc[FIELD.store]]
			if (store === STORE.schema && doc[FIELD.type] && doc[FIELD.key])
				schema.push(doc);
			if (store === STORE.config && doc[FIELD.type] && doc[FIELD.key])
				config.push(doc);

			if (debug) this.dbg('delClient: %s, %j', doc[FIELD.store], doc);
		})

		if (schema.length)
			setSchema(state[STORE.schema] as Schema[]);	// rebuild the STORES / SORTBY / FILTER
		if (config.length)
			setConfig(state[STORE.config] as Config[]);	// rebuild the COMMENT variable
		setState({ ...state });
	}

	@Action(ClientAction.Trunc)
	truncStore({ setState }: StateContext<TStateSlice<StoreMeta>>, { debug }: ClientAction.Trunc) {
		if (debug) this.dbg('truncClient');
		setState({});
	}
}