import { State, Action, StateContext, NgxsOnInit, Store } from '@ngxs/store';
import { Device } from '@dbase/state/state.action';
import { TStateSlice } from '@dbase/state/state.define';

import { FIELD, STORE, COLLECTION } from '@dbase/data/data.define';
import { IStoreMeta, IConfig } from '@dbase/data/data.schema';

import { makeTemplate } from '@lib/string.library';
import { cloneObj } from '@lib/object.library';
import { isString } from '@lib/type.library';
import { asArray } from '@lib/array.library';
import { dbg } from '@lib/logger.library';

/**
 * DeviceState is for items derived from the server.  
 * Currently this is _config_ with placeholders evaluated, and  
 * UI preferences for _login_ (which are needed prior to authentication)
 */
@State<TStateSlice<IStoreMeta>>({
	name: COLLECTION.device,
	defaults: {}
})
export class DeviceState implements NgxsOnInit {
	private dbg = dbg(this);

	constructor(private store: Store) { this.init(); }

	ngxsOnInit(_ctx: StateContext<TStateSlice<IStoreMeta>>) { this.init(); }

	private init() {
		this.dbg('init:');
	}

	@Action(Device.Set)
	setStore({ setState, getState }: StateContext<TStateSlice<IStoreMeta>>, { payload, debug }: Device.Set) {
		const state = cloneObj(getState()) || {};

		asArray(payload).forEach(doc => {
			if (doc[FIELD.store] === STORE.config) {		// Config change detected
				const group = '@' + doc[FIELD.store].replace(/_/g, '') + '@';
				const fix = this.fixConfig();

				state[group] = this.filterState(state, doc);
				state[group].push(...fix);
				// if (debug) this.dbg('setDevice: %j', doc);
			}
		})

		setState({ ...state });
	}

	@Action(Device.Del)
	delStore({ getState, setState }: StateContext<TStateSlice<IStoreMeta>>, { payload, debug }: Device.Del) {
		const state = cloneObj(getState()) || {};
		const segment = FIELD.store;

		asArray(payload).forEach(doc => {
			const slice = doc[segment];
			state[slice] = this.filterState(state, doc, segment);

			if (state[slice].length === 0)
				delete state[slice];
			if (debug) this.dbg('delDevice: %j', doc);
		})

		setState({ ...state });
	}

	// TODO: dont delete local-device store?
	@Action(Device.Trunc)
	truncStore({ setState }: StateContext<TStateSlice<IStoreMeta>>, { debug }: Device.Trunc) {
		if (debug) this.dbg('truncDevice');
		setState({});
	}

	/** remove an item from the Device Store */
	private filterState(state: TStateSlice<IStoreMeta>, payload: IStoreMeta, segment = FIELD.store) {
		const group = '@' + payload[segment].replace(/_/g, '') + '@';
		const curr = state && state[payload[group]] || [];

		return [...curr.filter(itm => itm[FIELD.id] !== payload[FIELD.id])];
	}

	/** resolve some placeholder variables in IConfig[] */
	private fixConfig = () => {
		const placeholder: { [key: string]: string; } = {};
		const state = this.store.selectSnapshot(state => state);	// get existing state
		const config = (state.client[STORE.config] as IConfig[])
			.filter(row => !row[FIELD.expire]);							// slice it to get Config, skip expired

		config
			.filter(row => row[FIELD.key] === 'default')		// get the placeholder values on first pass
			.filter(row => isString(row.value))
			.forEach(row => placeholder[row[FIELD.type]] = row.value);

		return cloneObj(config)
			.filter(row => row[FIELD.key] !== 'default')		// skip Config 'defaults'
			.map(row => {
				const subst: { [key: string]: string; } = {}
				Object.entries<any>(row.value).forEach(item => {		// for each item in the 'value' field
					const tpl = makeTemplate(item[1]);					// turn it into a template literal
					subst[item[0]] = tpl(placeholder);					// evaluate the template literal against the placeholders
				})

				return { ...row, [FIELD.store]: STORE.local, [FIELD.type]: 'config', value: subst }
			})
	}
}