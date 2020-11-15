import { Injectable } from '@angular/core';
import { State, Action, StateContext, NgxsOnInit, Store } from '@ngxs/store';
import { deviceAction } from '@dbase/state/state.action';
import { TStateSlice } from '@dbase/state/state.define';

import { FIELD, STORE, COLLECTION } from '@dbase/data.define';
import { FireDocument, Config } from '@dbase/data.schema';

import { makeTemplate } from '@library/string.library';
import { cloneObj } from '@library/object.library';
import { isString } from '@library/type.library';
import { asArray } from '@library/array.library';
import { dbg } from '@library/logger.library';

/**
 * DeviceState is for items derived from the server.  
 * Currently this is _config_ with placeholders evaluated, and  
 * UI preferences for _login_ (which are needed prior to authentication)
 */
@Injectable()
@State<TStateSlice<FireDocument>>({
	name: COLLECTION.Device,
	defaults: {}
})
export class DeviceState implements NgxsOnInit {
	#dbg = dbg(this);

	constructor(private store: Store) { this.init(); }

	ngxsOnInit(_ctx: StateContext<TStateSlice<FireDocument>>) { this.init(); }

	private init() {
		this.#dbg('init:');
	}

	@Action(deviceAction.Set)
	setStore({ setState, getState }: StateContext<TStateSlice<FireDocument>>, { payload, debug }: deviceAction.Set) {
		const state = cloneObj(getState()) || {};

		asArray(payload).forEach(doc => {
			if (doc[FIELD.Store] === STORE.Config) {		// Config change detected
				const group = '@' + doc[FIELD.Store].replace(/_/g, '') + '@';
				const fix = this.fixConfig();

				state[group] = this.filterState(state, doc);
				state[group].push(...fix);
				// if (debug) this.dbg('setDevice: %j', doc);
			}
		})

		setState({ ...state });
	}

	@Action(deviceAction.Del)
	delStore({ getState, setState }: StateContext<TStateSlice<FireDocument>>, { payload, debug }: deviceAction.Del) {
		const state = cloneObj(getState()) || {};
		const segment = FIELD.Store;

		asArray(payload).forEach(doc => {
			const slice = doc[segment];
			state[slice] = this.filterState(state, doc, segment);

			if (state[slice].length === 0)
				delete state[slice];
			if (debug) this.#dbg('delDevice: %j', doc);
		})

		setState({ ...state });
	}

	// TODO: dont delete local-device store?
	@Action(deviceAction.Trunc)
	truncStore({ setState }: StateContext<TStateSlice<FireDocument>>, { debug }: deviceAction.Trunc) {
		if (debug) this.#dbg('truncDevice');
		setState({});
	}

	/** remove an item from the Device Store */
	private filterState(state: TStateSlice<FireDocument>, payload: FireDocument, segment = FIELD.Store) {
		const group = '@' + payload[segment].replace(/_/g, '') + '@';
		const curr = state && state[payload[group]] || [];

		return [...curr.filter(itm => itm[FIELD.Id] !== payload[FIELD.Id])];
	}

	/** resolve some placeholder variables in IConfig[] */
	private fixConfig = () => {
		const placeholder: Record<string, string> = {};
		const state = this.store.selectSnapshot(state => state);	// get existing state
		const config = (state.client[STORE.Config] as Config[])
			.filter(row => !row[FIELD.Expire]);							// slice it to get Config, skip expired

		config
			.filter(row => row[FIELD.Key] === 'default')		// get the placeholder values on first pass
			.filter(row => isString(row.value))
			.forEach(row => placeholder[row[FIELD.Type]] = row.value);

		return cloneObj(config)
			.filter(row => row[FIELD.Key] !== 'default')		// skip Config 'defaults'
			.map(row => {
				const subst: Record<string, string> = {}
				Object.entries<any>(row.value).forEach(item => {		// for each item in the 'value' field
					const tpl = makeTemplate(item[1]);					// turn it into a template literal
					subst[item[0]] = tpl(placeholder);					// evaluate the template literal against the placeholders
				})

				return { ...row, [FIELD.Store]: STORE.Local, [FIELD.Type]: 'config', value: subst }
			})
	}
}