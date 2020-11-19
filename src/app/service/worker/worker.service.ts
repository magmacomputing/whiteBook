import { Injectable } from '@angular/core';

import { isUndefined } from '@library/type.library';
import { dbg } from '@library/logger.library';

// TODO:  Can this be made multi-instance and still be Injectable
@Injectable({ providedIn: 'root' })
export class WorkerService {
	#dbg = dbg(this, 'WorkerService');
	#worker: Worker | undefined = undefined;

	constructor() {
		const script = './app.worker';
		this.#dbg('new');

		if (isUndefined(Worker)) {
			this.#dbg('Web Workers are not supported in this environment');
			return;
		}

		this.#worker = new Worker('./app.worker', { type: 'module' });	// Start a Worker
		this.#worker.onmessage = this.recv.bind(this);					// Define a handler

		this.send(`init`);
	}

	send(msg: any) {																					// send a message to the Worker
		this.#worker?.postMessage(msg);
	}

	private recv({ data }: any) {															// receive a response from the Worker
		this.#dbg(data);
	}
}
