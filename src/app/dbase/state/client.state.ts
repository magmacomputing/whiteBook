import { State, Action, StateContext, NgxsOnInit, Store } from '@ngxs/store';
import { SLICE, IStoreState, IStoreDoc, SetClient, DelClient, TruncClient, SetLocal } from '@dbase/state/store.define';

import { FIELD, STORE } from '@dbase/data/data.define';
import { cloneObj } from '@lib/object.library';
import { isUndefined } from '@lib/type.library';
import { dbg } from '@lib/logger.library';

@State<IStoreState<IStoreDoc>>({
	name: SLICE.client,
	defaults: {}
})
export class ClientState implements NgxsOnInit {
	private dbg: Function = dbg.bind(this);

	constructor(private readonly store: Store) { }

	ngxsOnInit(_ctx: StateContext<IStoreState<IStoreDoc>>) { this.dbg('init:'); }

	@Action(SetClient)
	setStore({ patchState, getState }: StateContext<IStoreState<IStoreDoc>>, { payload, debug }: SetClient) {
		const state = getState() || {};
		const store = this.filterClient(state, payload);

		store.push(payload);										// push the new/changed ClientDoc into the Store
		state[payload[FIELD.store]] = store;

		if (payload[FIELD.store] === STORE.config)
			this.store.dispatch(new SetLocal(payload));

		if (debug) this.dbg('setClient: %s, %j', payload[FIELD.store], payload);
		patchState({ ...state });
	}

	@Action(DelClient)
	delStore({ patchState, getState }: StateContext<IStoreState<IStoreDoc>>, { payload, debug }: DelClient) {
		const state = getState() || {};
		const store = this.filterClient(getState(), payload);

		if (store.length === 0)
			delete state[payload[FIELD.store]]
		else state[payload[FIELD.store]] = store;

		if (debug) this.dbg('delClient: %s, %j', payload[FIELD.store], payload);
		patchState({ ...state });
	}

	@Action(TruncClient)
	truncStore({ setState }: StateContext<IStoreState<IStoreDoc>>, { debug }: TruncClient) {
		if (debug) this.dbg('truncClient');
		setState({});
	}

	/** remove an item from the Client Store */
	private filterClient(state: IStoreState<IStoreDoc>, payload: IStoreDoc) {
		const curr = state && state[payload[FIELD.store]] || [];

		return [...curr.filter(itm => itm[FIELD.id] !== payload[FIELD.id])];
	}
}

/** resolve some placeholder variables in IConfig[] */
const fixConfig = (config: IStoreDoc[]) => {
	let project = '';
	let region = '';
	let indexOAuth: number | undefined = undefined;
	let indexClone: number | undefined = undefined;

	config
		.filter(row => row[FIELD.store] === STORE.config && !row[FIELD.expire])
		.forEach((row, idx) => {
			switch (row[FIELD.key]) {
				case 'project':
					project = row.value;
					break;
				case 'region':
					region = row.value;
					break;
				case 'oauth':
					indexOAuth = idx;
					break;
				case '_oauth_':
					indexClone = idx;
					break;
			}
		});

	if (!isUndefined(indexOAuth) && project && region) {
		const orig = config[indexOAuth];
		const clone = !isUndefined(indexClone)
			? config[indexClone]									// point to previous clone
			: cloneObj(orig);											// create a new clone

		clone[FIELD.key] = '_oauth_';					// clone search-key
		clone.value = {};												// reset values
		Object.keys(orig.value)									// for each key in original's <value> object
			.forEach(itm => clone.value[itm] = orig.value[itm]
				.replace('${region}', region)				// set clone's value to be...
				.replace('${project}', project));		//	orig's value with placeholders replaced

		if (isUndefined(indexClone))
			config.push(clone);										// insert a clone row into State
	}

	return config;
}