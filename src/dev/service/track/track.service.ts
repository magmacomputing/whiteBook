import { Injectable } from '@angular/core';

import { DBaseModule } from '@dbase/dbase.module';
import { FireService } from '@dbase/fire/fire.service';
import { AuthService } from '@service/auth/auth.service';

import { STORE, FIELD, TRACK } from '@dbase/data.define';
import { Track } from '@dbase/data.schema';

import { sprintf } from '@library/string.library';
import { fix } from '@library/number.library';
import { getInstant } from '@library/instant.library';
import { dbg } from '@library/logger.library';

@Injectable({ providedIn: DBaseModule })
export class TrackService {
	#logLevel = TRACK.all;
	#dbg = dbg(this);

	constructor(private fire: FireService, private auth: AuthService) { }

	async write(fmt?: any, ...data: any[]) {
		const now = getInstant();
		const uid = await this.auth.current
			.then(user => user && user.uid)

		const trackCol = `/${STORE.log}/${now.yy}${fix(now.mm)}/${fix(now.dd)}` as STORE;
		const trackDoc = {
			[FIELD.store]: STORE.log,
			[FIELD.type]: this.#logLevel,
			[FIELD.uid]: uid || 'anonymous',
			[FIELD.stamp]: now.ts,
			date: { year: now.yy, month: now.mm, day: now.dd },
			msg: sprintf(fmt, ...data),
		} as Track

		this.#dbg('track: %j', trackDoc);
		this.fire.setDoc(trackCol, trackDoc);
	}

	set level(level: TRACK) {
		this.#logLevel = level;
	}

	get level() {
		return this.#logLevel;
	}
}
