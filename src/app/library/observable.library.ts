import { Subject, of } from 'rxjs';
import { takeUntil, tap, delay, repeat } from 'rxjs/operators';

import { Instant } from '@library/instant.library';

/**
 * return an Observable, delayed until midnight.  
 * provide a Subject, used to tear-down the Observable
 */
export const setTimer = (stop: Subject<any>) => {
	return of(0)										// a single-emit Observable
		.pipe(
			takeUntil(stop),
			tap(_ => console.log('ObservableLibrary.setTimer: %s', new Instant().add(1, 'day').startOf('day').format(Instant.FORMAT.dayTime))),
			delay(new Instant().add(1, 'day').startOf('day').toDate()),
			repeat(),										// restart the Observable
		)
}