import { Injectable, NgZone } from '@angular/core';
import { Router, UrlTree } from '@angular/router';

import { dbg } from '@library/logger.library';

@Injectable({ providedIn: 'root' })
export class NavigateService {
	#dbg = dbg(this);

	constructor(private router: Router, private zone: NgZone) { this.#dbg('new'); }

	route(url: string | UrlTree) {
		this.#dbg('route: /%s', url);

		return new Promise<boolean>((resolve, reject) =>
			this.zone.run(_ =>
				this.router.navigateByUrl(url)
					.then(resolve)
					.catch(reject)
			)
		)
	}

	get url() {
		return this.router.url;
	}
}