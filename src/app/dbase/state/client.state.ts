import { State, Action, StateContext, NgxsOnInit, Store } from '@ngxs/store';
import { Client, filterState } from '@dbase/state/state.action';
import { TStateSlice } from '@dbase/state/state.define';

import { SLICES, COMMENT } from '@library/config.define';
import { setSchema, setConfig } from '@library/config.library';
import { STORE, FIELD, COLLECTION } from '@dbase/data/data.define';
import { IStoreMeta, ISchema, IConfig } from '@dbase/data/data.schema';

import { asArray } from '@lib/array.library';
import { isEmpty, cloneObj } from '@lib/object.library';
import { dbg } from '@lib/logger.library';

@State<TStateSlice<IStoreMeta>>({
	name: COLLECTION.client,
	defaults: {}
})
export class ClientState implements NgxsOnInit {
	private dbg = dbg(this);

	constructor(private readonly store: Store) { this.init(); }

	ngxsOnInit(_ctx: StateContext<TStateSlice<IStoreMeta>>) { /** this.init(); */}

	private init() {
		this.dbg('init:');
		this.store.selectOnce(state => state[COLLECTION.client])
			.toPromise()
			.then(client => {
				setSchema(client && client[STORE.schema]);				// initial load of STORES / SORTBY / FILTER
				setConfig(client && client[STORE.config]);				// initial load of COMMENT
			})
	}

	@Action(Client.Set)
	setStore({ getState, setState }: StateContext<TStateSlice<IStoreMeta>>, { payload, debug }: Client.Set) {
		const state = cloneObj(getState()) || {};
		const schema: IStoreMeta[] = [];
		const config: IStoreMeta[] = [];

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
			setSchema(state[STORE.schema] as ISchema[]);	// rebuild the STORES / SORTBY / FILTER
		if (config.length)
			setConfig(state[STORE.config] as IConfig[]);
		setState({ ...state });
	}

	@Action(Client.Del)
	delStore({ getState, setState }: StateContext<TStateSlice<IStoreMeta>>, { payload, debug }: Client.Del) {
		const state = cloneObj(getState()) || {};
		const schema: IStoreMeta[] = [];
		const config: IStoreMeta[] = [];

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
			setSchema(state[STORE.schema] as ISchema[]);	// rebuild the STORES / SORTBY / FILTER
		if (config.length)
			setConfig(state[STORE.config] as IConfig[]);	// rebuild the COMMENT variable
		setState({ ...state });
	}

	@Action(Client.Trunc)
	truncStore({ setState }: StateContext<TStateSlice<IStoreMeta>>, { debug }: Client.Trunc) {
		if (debug) this.dbg('truncClient');
		setState({});
	}
}