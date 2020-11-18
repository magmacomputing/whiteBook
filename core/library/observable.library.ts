import { Subject, timer } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { Instant } from '@library/instant.library';
import { getCaller } from '@library/utility.library';
import { dbg } from '@library/logger.library';

/**
 * init an Observable which emits at midnight everyday.   
 * provide a callback to invoke at midnight as
 * ```
 * new DayTimer(this.callback.bind(this))
 * ```
 */
export class DayTimer {
	#dbg = dbg(this, 'DayTimer');
	#caller = getCaller();
	#stop$!: Subject<any>;											// notify Subscriptions to complete

	constructor(callback: Function) { this.start(callback); }

	start(callback: Function) {
		const midnight = new Instant()
			.add(1, 'day')
			.startOf('day');												// determine day-change

		this.stop();															// stop the previous Subject
		this.#stop$ = new Subject<any>();					// start a new Subject

		this.log('new', 0, midnight);							// show the initial Timer
		timer(midnight.toDate(), Instant.TIMES.day)// start a Timer from midnight, refires one day later
			.pipe(takeUntil(this.#stop$))						// until notified to stop
			.subscribe({
				next: (nbr) => {
					this.log('set', nbr);								// show the next Timer
					callback?.()												// do callback at midnight
				},
				complete: () => this.log('end')
			})
	}

	stop(callback?: Function) {
		this.#stop$?.next();											// notify Timer to stop
		this.#stop$?.unsubscribe();								// tear-down Subject

		callback?.();															// an optional final callback
	}

	private log(call: 'new' | 'set' | 'end' = 'set', nbr = 0, inst?: Instant.TYPE) {
		this.#dbg('%s.%sTimer: (%s) %s', this.#caller, call, nbr,
			new Instant(inst).format(Instant.FORMAT.dayTime))
	}
}