import { Subject, timer } from 'rxjs';
import { takeUntil, tap } from 'rxjs/operators';

import { Instant } from '@library/instant.library';
import { getCaller } from '@library/utility.library';

/**
 * return an Observable which emits at midnight everyday.   
 * provide a Subject, used to tear-down the Observable
 */
export const setTimer = (stop: Subject<any>) => {
	const midnight = new Instant().add(1, 'day').startOf('day');
	const addOneDay = 86_400_000;					// number of milliseconds in a day

	console.log('%s.initTimer: %s', getCaller(), midnight.format(Instant.FORMAT.dayTime));
	return timer(midnight.toDate(), addOneDay)
		.pipe(
			takeUntil(stop),
			tap(nbr => console.log('lib.setTimer: (%s) %s', nbr, new Instant().format(Instant.FORMAT.dayTime)),
			)
		);
}