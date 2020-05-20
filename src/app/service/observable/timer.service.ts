import { Injectable } from '@angular/core';
import { Subject, of } from 'rxjs';
import { delay, takeUntil, repeat, tap } from 'rxjs/operators';

import { Instant } from '@library/instant.library';
import { dbg } from '@library/logger.library';

@Injectable({ providedIn: 'root' })
export class TimerService {
	private dbg = dbg(this, this.constructor.name);
	stop$!: Subject<any>;

	constructor() { this.dbg('new'); }

	setTimer(stop?: Subject<any>) {
		if (stop)
			this.stop$ = stop;						// set a timer-stop

		return of(0)										// a single-emit Observable
			.pipe(
				takeUntil(this.stop$),
				tap(_ => this.dbg('timer: %s', new Instant().add(1, 'day').startOf('day').format(Instant.FORMAT.dayTime))),
				delay(new Instant().add(1, 'day').startOf('day').toDate()),
				repeat(),										// restart the Observable
			)
	}
}
