import { Router } from '@angular/router';
import { Action, State, StateContext } from '@ngxs/store';

import { dbg } from '@lib/logger.library';

export class Navigate {
	static readonly type = '[Router] Navigate';
	constructor(public payload: string) { }
}

@State<string>({
	name: 'router',
	defaults: ''
})
export class RouterState {
	private dbg: Function = dbg.bind(this);

	constructor(private router: Router) { }

	@Action(Navigate)
	async changeRoute(ctx: StateContext<string>, action: Navigate) {
		const path = action.payload;

		this.dbg('navigate: %j', path);
		await this.router.navigate([path]);
		ctx.setState(path);
	}
}