import { Subject, timer } from 'rxjs';
import { takeUntil, tap } from 'rxjs/operators';

import { Instant } from '@library/instant.library';

/**
 * return an Observable which emits at midnight everyday.   
 * provide a Subject, used to tear-down the Observable
 */
export const setTimer = (stop: Subject<any>) => {
	const midnight = new Instant().add(1, 'day').startOf('day');
	const addOneDay = 86_400_000;					// number of milliseconds in a day

	return timer(midnight.toDate(), addOneDay)
		.pipe(
			takeUntil(stop),
			tap(nbr => console.log('ObservableLibrary.setTimer: (%s) %s', nbr, new Instant().format(Instant.FORMAT.dayTime)),
			)
		);
}