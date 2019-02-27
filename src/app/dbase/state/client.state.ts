import { State, Action, StateContext, NgxsOnInit, Store } from '@ngxs/store';
import { SetClient, DelClient, TruncClient, SetLocal } from '@dbase/state/state.action';
import { TStateSlice, SLICE } from '@dbase/state/state.define';

import { STORE, FIELD, SLICES, SORTBY, FILTER } from '@dbase/data/data.define';
import { IStoreMeta, ISchema } from '@dbase/data/data.schema';

import { TString } from '@lib/type.library';
import { IObject, isEmpty } from '@lib/object.library';
import { dbg } from '@lib/logger.library';

@State<TStateSlice<IStoreMeta>>({
	name: SLICE.client,
	defaults: {}
})
export class ClientState implements NgxsOnInit {
	private dbg = dbg(this);

	constructor(private readonly store: Store) { }

	ngxsOnInit(_ctx: StateContext<TStateSlice<IStoreMeta>>) {
		this.dbg('init:');
		this.setSchema();												// initial load of STORES / SORTBY / FILTER
	}

	@Action(SetClient)
	setStore({ patchState, getState }: StateContext<TStateSlice<IStoreMeta>>, { payload, debug }: SetClient) {
		const state = getState() || {};
		const store = this.filterClient(state, payload);

		store.push(payload);										// push the new/changed ClientDoc into the Store
		state[payload[FIELD.store]] = store;

		if (payload[FIELD.store] === STORE.config)
			this.store.dispatch(new SetLocal(payload));
		if (payload[FIELD.store] === STORE.schema && (debug || isEmpty(SLICES)))
			this.setSchema();											// rebuild the STORES / SORTBY / FILTER

		if (debug) this.dbg('setClient: %s, %j', payload[FIELD.store], payload);
		patchState({ ...state });
	}

	@Action(DelClient)
	delStore({ patchState, getState }: StateContext<TStateSlice<IStoreMeta>>, { payload, debug }: DelClient) {
		const state = getState() || {};
		const store = this.filterClient(getState(), payload);

		if (payload[FIELD.store] === STORE.schema && payload[FIELD.type] && payload[FIELD.key]) {
			const type = payload[FIELD.type]!;
			const key = payload[FIELD.key];

			SLICES[type] = SLICES[type].filter(store => store !== payload[FIELD.key]);
			delete SORTBY[key];
			delete FILTER[key];
		}

		if (store.length === 0)
			delete state[payload[FIELD.store]]
		else state[payload[FIELD.store]] = store;

		if (debug) this.dbg('delClient: %s, %j', payload[FIELD.store], payload);
		patchState({ ...state });
	}

	@Action(TruncClient)
	truncStore({ setState }: StateContext<TStateSlice<IStoreMeta>>, { debug }: TruncClient) {
		if (debug) this.dbg('truncClient');
		setState({});
	}

	/** remove an item from the Client Store */
	private filterClient(state: TStateSlice<IStoreMeta>, payload: IStoreMeta) {
		const curr = state && state[payload[FIELD.store]] || [];

		return [...curr.filter(itm => itm[FIELD.id] !== payload[FIELD.id])];
	}

	/** rebuild values for STORES, SORTBY, FILTER variables */
	private setSchema() {
		const acc = {
			slices: {} as IObject<string[]>,
			sortby: {} as IObject<TString>,
			filter: {} as IObject<string[]>,
		}

		this.store
			.selectOnce(state => state)
			.toPromise()
			.then(state => {
				const schemas: ISchema[] = state[SLICE.client][STORE.schema] || [];

				return schemas.reduce((acc, schema) => {
					const type = schema[FIELD.type];
					const key = schema[FIELD.key];

					if (!schema[FIELD.hidden]) {
						acc.slices[type] = acc.slices[type] || [];
						acc.slices[type].push(schema[FIELD.key]);
						acc.slices[type].sort();
					}

					if (schema.sort)
						acc.sortby[key] = schema.sort;

					if (schema.filter)
						acc.filter[key] = schema.filter;

					return acc;													// dummy <return>
				}, acc)
			})
			.then(acc => {
				Object.keys(acc.slices).forEach(type => SLICES[type] = acc.slices[type]);
				Object.keys(acc.sortby).forEach(type => SORTBY[type] = acc.sortby[type]);
				Object.keys(acc.filter).forEach(type => FILTER[type] = acc.filter[type]);

				// this.dbg('SLICES: %j', SLICES);
				// this.dbg('SORTBY: %j', SORTBY);
				// this.dbg('FILTER: %j', FILTER);
			})
	}
}