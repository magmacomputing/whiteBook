import { Subject, timer } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { Instant } from '@library/instant.library';
import { getCaller } from '@library/utility.library';
import { isNullish } from '@library/type.library';
import { dbg } from '@library/logger.library';

/**
 * init an Observable which emits at the same time everyday.   
 * provide a callback to invoke on alarm, as
 * ```
 * new DayTimer(callback.bind(this))
 * ```
 */
export class DayTimer {
	#dbg = dbg(this, 'DayTimer');
	#caller = getCaller();
	#stop$!: Subject<any>;											// notify Subscriptions to complete

	constructor(callback?: Function, alarm?: Instant.TYPE) { this.start(callback, alarm); }

	start(callback?: Function, alarm?: Instant.TYPE) {
		if (isNullish(alarm)) {										// default midnight
			alarm = new Instant()
				.add(1, 'day')
				.startOf('day');
		} else {
			alarm = new Instant(alarm)							// cast as Instant
			if (alarm.time < new Instant().time)		// if time has already passed
				alarm = alarm.add(1, 'day');					// add one-day
		}

		this.stop();															// stop the previous Subject (useful for a re-start)
		this.#stop$ = new Subject<any>();					// start a new Subject

		this.log('new', 0, alarm);								// show the initial DayTimer
		timer(alarm.toDate(), Instant.TIMES.day)	// start a timer for the alarm-time, and re-fire daily
			.pipe(takeUntil(this.#stop$))						// until notified to stop
			.subscribe({
				next: (nbr) => {
					this.log('set', nbr);								// show the next DayTimer
					callback?.()												// do callback at midnight
				},
				complete: () => {
					this.log('end')
				}
			})
	}

	stop(callback?: Function) {
		this.#stop$?.next();											// notify DayTimer to stop
		this.#stop$?.unsubscribe();								// tear-down Subject

		callback?.();															// an optional final callback
	}

	private log(call: 'new' | 'set' | 'end' = 'set', nbr = 0, inst?: Instant.TYPE) {
		this.#dbg('%s.%sTimer: (%s) %s', this.#caller, call, nbr,
			new Instant(inst).format(Instant.FORMAT.dayTime))
	}
}