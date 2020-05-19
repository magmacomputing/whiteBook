import { Injectable } from '@angular/core';
import { Subject, of, BehaviorSubject, scheduled } from 'rxjs';
import { delay, takeUntil } from 'rxjs/operators';

import { Instant } from '@library/instant.library';
import { dbg } from '@library/logger.library';

@Injectable({ providedIn: 'root' })
export class TimerService {
	private self = 'TimerService';
	private dbg = dbg(this, this.self);

	private subject!: BehaviorSubject<any>;

	constructor(private stop$: Subject<any>) {
		this.setTimer();
	}

	setTimer() {
		const defer = new Instant().add(1, 'day').startOf('day');
		this.dbg('timeOut: %s', defer.format(Instant.FORMAT.dayTime));

		// this.subject.

		return scheduled()										// a single-emit Observable
			.pipe(
				takeUntil(this.stop$),
				delay(defer.toDate()),
			)
	}
}
