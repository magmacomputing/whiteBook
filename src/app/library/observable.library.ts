import { Subject, timer } from 'rxjs';
import { takeUntil, tap, count } from 'rxjs/operators';

import { Instant } from '@library/instant.library';
import { getCaller } from '@library/utility.library';

/**
 * return an Observable which emits at midnight everyday.   
 * provide a Subject, used to tear-down the Observable
 */
export const setTimer = (stop: Subject<any>) => {
	const midnight = new Instant().add(1, 'day').startOf('day');
	const addOneDay = 86_400_000;					// number of milliseconds in a day
	const caller = getCaller();

	console.log('%s.newTimer: %s', caller, midnight.format(Instant.FORMAT.dayTime));
	return timer(midnight.toDate(), addOneDay)
		.pipe(
			tap(nbr => console.log('%s.setTimer: (%s) %s', caller, nbr, new Instant().add(1, 'day').startOf('day').format(Instant.FORMAT.dayTime))),
			takeUntil(stop),
			count(),													// this will fire when the <stop> is detected
			tap(_nbr => console.log('%s.endTimer: ', caller)),
		);
}