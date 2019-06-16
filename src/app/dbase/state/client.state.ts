import { State, Action, StateContext, NgxsOnInit, Store } from '@ngxs/store';
import { SetClient, DelClient, TruncClient, filterState } from '@dbase/state/state.action';
import { TStateSlice, SLICE } from '@dbase/state/state.define';

import { SLICES } from '@library/config.define';
import { setSchema } from '@library/config.library';
import { STORE, FIELD, COLLECTION } from '@dbase/data/data.define';
import { IStoreMeta, ISchema } from '@dbase/data/data.schema';

import { asArray } from '@lib/array.library';
import { isEmpty, cloneObj } from '@lib/object.library';
import { dbg } from '@lib/logger.library';

@State<TStateSlice<IStoreMeta>>({
	name: SLICE.client,
	defaults: {}
})
export class ClientState implements NgxsOnInit {
	private dbg = dbg(this);

	constructor(private readonly store: Store) { this.init(); }

	ngxsOnInit(_ctx: StateContext<TStateSlice<IStoreMeta>>) { this.init(); }

	private init() {
		this.dbg('init:');
		this.store.selectOnce(state => state[COLLECTION.client])
			.toPromise()
			.then(client => client && client[STORE.schema] || [])
			.then((schema: ISchema[]) => setSchema(schema))				// initial load of STORES / SORTBY / FILTER
	}

	@Action(SetClient)
	setStore({ getState, setState }: StateContext<TStateSlice<IStoreMeta>>, { payload, debug }: SetClient) {
		const state = cloneObj(getState()) || {};
		const schema: IStoreMeta[] = [];

		asArray(payload).forEach(doc => {
			const store = doc[FIELD.store];
			state[store] = filterState(state, doc);
			state[store].push(doc);									// push the new/changed ClientDoc into the Store

			if (doc[FIELD.store] === STORE.schema && (debug || isEmpty<object>(SLICES)))
				schema.push(doc);											// if STORE.schema changes, rebuild schema-variables

			if (debug) this.dbg('setClient: %s, %j', doc[FIELD.store], doc);
		})

		if (schema.length)
			setSchema(state[STORE.schema] as ISchema[]);	// rebuild the STORES / SORTBY / FILTER
		setState({ ...state });
	}

	@Action(DelClient)
	delStore({ getState, setState }: StateContext<TStateSlice<IStoreMeta>>, { payload, debug }: DelClient) {
		const state = cloneObj(getState()) || {};
		const schema: IStoreMeta[] = [];

		asArray(payload).forEach(doc => {
			const store = doc[FIELD.store];
			state[store] = filterState(state, doc);

			if (state[store].length === 0)
				delete state[doc[FIELD.store]]
			if (store === STORE.schema && doc[FIELD.type] && doc[FIELD.key])
				schema.push(doc);

			if (debug) this.dbg('delClient: %s, %j', doc[FIELD.store], doc);
		})

		if (schema.length)
			setSchema(state[STORE.schema] as ISchema[]);	// rebuild the STORES / SORTBY / FILTER
		setState({ ...state });
	}

	@Action(TruncClient)
	truncStore({ setState }: StateContext<TStateSlice<IStoreMeta>>, { debug }: TruncClient) {
		if (debug) this.dbg('truncClient');
		setState({});
	}
}