import { State, Action, StateContext, NgxsOnInit, Store } from '@ngxs/store';
import { SLICE, SetLocal, DelLocal, TruncLocal } from '@dbase/state/state.action';
import { TStateSlice } from '@dbase/state/state.define';

import { FIELD, STORE } from '@dbase/data/data.define';
import { IStoreMeta } from '@dbase/data/data.schema';

import { cloneObj } from '@lib/object.library';
import { isUndefined } from '@lib/type.library';
import { dbg } from '@lib/logger.library';

/**
 * LocalState is for items derived from the server.  
 * Currently this is _config_ with placeholders evaluated, and  
 * UI preferences for _login_ (which are needed prior to authentication)
 */
@State<TStateSlice<IStoreMeta>>({
	name: SLICE.local,
	defaults: {}
})
export class LocalState implements NgxsOnInit {
	private dbg = dbg(this);

	constructor(private store: Store) { }

	ngxsOnInit(_ctx: StateContext<TStateSlice<IStoreMeta>>) { this.dbg('init:'); }

	@Action(SetLocal)
	setStore({ patchState, getState }: StateContext<TStateSlice<IStoreMeta>>, { payload, debug }: SetLocal) {
		const state = getState() || {};
		const group = '@' + payload[FIELD.store].replace(/_/g, '') + '@';
		const store = state[group] || [];

		if (payload[FIELD.store] === STORE.config) {// Config change detected
			const fix = this.fixConfig()
			if (fix) {
				store.length = 0;												// erase existing Config
				store.push(fix);												// insert fixed Config
			}
		}

		state[group] = store;

		if (debug) this.dbg('setLocal: %s, %j', payload[FIELD.store], payload);
		patchState({ ...state });
	}

	@Action(DelLocal)
	delStore({ patchState, getState }: StateContext<TStateSlice<IStoreMeta>>, { payload, debug }: DelLocal) {
		const state = getState() || {};
		const store = this.filterLocal(getState(), payload);

		if (store.length === 0)
			delete state[payload[FIELD.store]]
		else state[payload[FIELD.store]] = store;

		if (debug) this.dbg('delLocal: %s, %j', payload[FIELD.store], payload);
		patchState({ ...state });
	}

	@Action(TruncLocal)
	truncStore({ setState }: StateContext<TStateSlice<IStoreMeta>>, { debug }: TruncLocal) {
		if (debug) this.dbg('truncLocal');
		setState({});
	}

	/** remove an item from the Local Store */
	private filterLocal(state: TStateSlice<IStoreMeta>, payload: IStoreMeta) {
		const curr = state && state[payload[FIELD.store]] || [];

		return [...curr.filter(itm => itm[FIELD.id] !== payload[FIELD.id])];
	}

	/** resolve some placeholder variables in IConfig[] */
	private fixConfig = () => {
		let project = '';
		let region = '';
		let index: number | undefined = undefined;
		let clone: IStoreMeta | undefined = undefined;

		const state = this.store.selectSnapshot(state => state);	// get existing state
		const config = state.client[STORE.config] as IStoreMeta[];		// slice it to get Config
		config
			.filter(row => !row[FIELD.expire])			// skip expired Configs
			.forEach((row, idx) => {								// loop through Config...
				switch (row[FIELD.key]) {							//	evaluating <key>
					case 'project':
						project = row.value;							// found a placeholder value
						break;
					case 'region':
						region = row.value;								// found a placeholder value
						break;
					case 'oauth':
						index = idx;											// found a placeholder field
						break;
				}
			});

		if (!isUndefined(index) && project && region) {
			const orig = config[index];
			clone = cloneObj(orig);									// create a clone

			clone[FIELD.key] = '_oauth_';						// clone search-key
			clone.value = {};												// reset values
			Object.keys(orig.value)									// for each key in original's <value> object
				.forEach(itm => clone!.value[itm] = orig.value[itm]
					.replace('${region}', region)				// set clone's value to be...
					.replace('${project}', project));		//	orig's value with placeholders replaced
		}

		return clone;
	}
}