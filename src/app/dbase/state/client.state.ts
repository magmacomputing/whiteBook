import { State, Action, StateContext, NgxsOnInit, Store } from '@ngxs/store';
import { SetClient, DelClient, TruncClient, SetLocal } from '@dbase/state/state.action';
import { TStateSlice, SLICE } from '@dbase/state/state.define';

import { STORE, FIELD, SLICES, SORTBY, FILTER } from '@dbase/data/data.define';
import { IStoreMeta, ISchema } from '@dbase/data/data.schema';

import { TString } from '@lib/type.library';
import { IObject, isEmpty } from '@lib/object.library';
import { asArray } from '@lib/array.library';
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
		this.setSchema();													// initial load of STORES / SORTBY / FILTER
	}

	@Action(SetClient)
	setStore({ patchState, getState }: StateContext<TStateSlice<IStoreMeta>>, { payload, debug }: SetClient) {
		const state = getState() || {};
		const local: IStoreMeta[] = [];
		const schema: IStoreMeta[] = [];

		asArray(payload).forEach(doc => {
			const store = doc[FIELD.store];
			state[store] = this.filterState(state, doc);
			state[store].push(doc);									// push the new/changed ClientDoc into the Store

			if (doc[FIELD.store] === STORE.config)
				local.push(doc);
			if (doc[FIELD.store] === STORE.schema && (debug || isEmpty(SLICES)))
				schema.push(doc);

			if (debug) this.dbg('setClient: %s, %j', doc[FIELD.store], doc);
		})

		if (schema.length)
			this.setSchema();												// rebuild the STORES / SORTBY / FILTER
		if (local.length)
			this.store.dispatch(new SetLocal(local));
		patchState({ ...state });
	}

	@Action(DelClient)
	delStore({ patchState, getState }: StateContext<TStateSlice<IStoreMeta>>, { payload, debug }: DelClient) {
		const state = getState() || {};

		asArray(payload).forEach(doc => {
			const store = doc[FIELD.store];
			state[store] = this.filterState(getState(), doc);

			if (store === STORE.schema && doc[FIELD.type] && doc[FIELD.key]) {
				const type = doc[FIELD.type]!;
				const key = doc[FIELD.key];

				SLICES[type] = SLICES[type].filter(store => store !== doc[FIELD.key]);
				delete SORTBY[key];
				delete FILTER[key];
			}

			if (state[store].length === 0)
				delete state[doc[FIELD.store]]

			if (debug) this.dbg('delClient: %s, %j', doc[FIELD.store], doc);
		})

		patchState({ ...state });
	}

	@Action(TruncClient)
	truncStore({ setState }: StateContext<TStateSlice<IStoreMeta>>, { debug }: TruncClient) {
		if (debug) this.dbg('truncClient');
		setState({});
	}

	/** remove an item from the Client Store */
	private filterState(state: TStateSlice<IStoreMeta>, payload: IStoreMeta, segment = FIELD.store) {
		const curr = state && state[payload[segment]] || [];

		return [...curr.filter(itm => itm[FIELD.id] !== payload[FIELD.id])];
	}

	/** rebuild values for STORES, SORTBY, FILTER variables */
	private setSchema() {
		const acc = {
			slices: {} as IObject<string[]>,
			sortby: {} as IObject<TString>,
			filter: {} as IObject<TString>,
		}

		this.store
			.selectOnce(state => state)
			.toPromise()
			.then(state => {
				const slice = state[SLICE.client] || {};
				const schemas: ISchema[] = slice[STORE.schema] || [];

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
			})
	}
}