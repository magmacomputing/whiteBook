import { Injectable } from '@angular/core';

import { Subject, of } from 'rxjs';
import { delay, takeUntil, repeat, tap } from 'rxjs/operators';

import { Instant } from '@library/instant.library';
import { dbg } from '@library/logger.library';

/**
 * Wire up an Observable that will emit at midnight each day.  
 * This is useful for Components that need to refresh their display to current date.
 */
@Injectable({ providedIn: 'root' })
export class TimerService {
	private dbg = dbg(this, this.constructor.name);

	constructor() { this.dbg('new'); }

	/**
	 * return an Observable, delayed until midnight.  
	 * provide a Subject, used to tear-down the Observable
	 */
	setTimer(stop: Subject<any>) {
		return of(0)										// a single-emit Observable
			.pipe(
				takeUntil(stop),
				tap(_ => this.dbg('timer: %s', new Instant().add(1, 'day').startOf('day').format(Instant.FORMAT.dayTime))),
				delay(new Instant().add(1, 'day').startOf('day').toDate()),
				repeat(),										// restart the Observable
			)
	}
}
