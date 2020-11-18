import { Injectable } from '@angular/core';

import { isDefined } from '@library/type.library';

@Injectable({ providedIn: 'root' })
export class WorkerService {

	constructor() {
		if (isDefined(Worker)) {
			// Create a new
			const worker = new Worker('./app.worker', { type: 'module' });
			worker.onmessage = ({ data }) => {
				console.log(`page got message: ${data}`);
			};
			worker.postMessage('hello');
		} else {
			// Web Workers are not supported in this environment.
			// You should add a fallback so that your program still executes correctly.
		}
	}
}
