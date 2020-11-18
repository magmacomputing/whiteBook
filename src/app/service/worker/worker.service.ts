import { Injectable } from '@angular/core';

import { isUndefined } from '@library/type.library';
import { dbg } from '@library/logger.library';

// TODO:  Can this be made multi-instance and still be Injectable
@Injectable({ providedIn: 'root' })
export class WorkerService {
	#dbg = dbg(this, 'WorkerService');
	#worker!: Worker;

	constructor() {
		const script = './app.worker';
		this.#dbg('new: %s', script);

		if (isUndefined(Worker)) {
			this.#dbg('Web Workers are not supported in this environment');
			return;
		}

		this.#worker = new Worker('./app.worker', { type: 'module' });	// Start a Worker
		this.#worker.onmessage = this.recv.bind(this);					// Define a handler

		this.send(`init: ${script}`);
	}

	start(worker: string | URL) {

	}

	send(msg: any) {
		this.#worker?.postMessage(msg);
	}

	private recv({ data }: any) {
		this.#dbg(`page got message: ${data}`);
	}
}
