import { State, Action, StateContext, NgxsOnInit, Store } from '@ngxs/store';
import { SetLocal, DelLocal, TruncLocal } from '@dbase/state/state.action';
import { TStateSlice, SLICE } from '@dbase/state/state.define';

import { FIELD, STORE, LOCAL } from '@dbase/data/data.define';
import { IStoreMeta } from '@dbase/data/data.schema';

import { makeTemplate } from '@lib/string.library';
import { cloneObj } from '@lib/object.library';
import { isString } from '@lib/type.library';
import { asArray } from '@lib/array.library';
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

	constructor(private store: Store) { this.init(); }

	ngxsOnInit(_ctx: StateContext<TStateSlice<IStoreMeta>>) { this.init(); }

	private init() {
		this.dbg('init:');
	}

	@Action(SetLocal)
	setStore({ patchState, getState }: StateContext<TStateSlice<IStoreMeta>>, { payload, debug }: SetLocal) {
		const state = getState() || {};
		
		asArray(payload).forEach(doc => {
			const group = '@' + doc[FIELD.store].replace(/_/g, '') + '@';
			const store = state[group] || [];

			if (doc[FIELD.store] === STORE.config) {		// Config change detected
				const fix = this.fixConfig()
				if (fix) {
					store.length = 0;												// erase existing Config
					store.push(...fix);											// insert fixed Config
				}
			}

			state[group] = store;
			patchState({ ...state });
		})
	}

	@Action(DelLocal)
	delStore({ patchState, getState }: StateContext<TStateSlice<IStoreMeta>>, { payload, debug }: DelLocal) {
		const state = getState() || {};

		asArray(payload).forEach(doc => {
			const store = this.filterLocal(getState(), doc);

			if (store.length === 0)
				delete state[doc[FIELD.store]]
			else state[doc[FIELD.store]] = store;

			if (debug) this.dbg('delLocal: %s, %j', doc[FIELD.store], doc);
			patchState({ ...state });
		})
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
		const placeholder: { [key: string]: string; } = {};
		const state = this.store.selectSnapshot(state => state);	// get existing state
		const config = (state.client[STORE.config] as IStoreMeta[])
			.filter(row => !row[FIELD.expire]);							// slice it to get Config, skip expired

		config
			.filter(row => row[FIELD.type] === 'default')		// get the placeholder values on first pass
			.filter(row => isString(row.value))
			.forEach(row => placeholder[row[FIELD.key]] = row.value);

		return cloneObj(config)
			.filter(row => row[FIELD.type] !== 'default')		// skip Config 'defaults'
			.map(row => {
				const subst: { [key: string]: string; } = {}
				Object.entries(row.value).forEach(item => {		// for each item in the 'value' field
					const tpl = makeTemplate(item[1]);					// turn it into a template literal
					subst[item[0]] = tpl(placeholder);					// evaluate the template literal against the placeholders
				})
				return Object.assign(row, { [FIELD.store]: LOCAL.config, value: subst });
			})
	}
}