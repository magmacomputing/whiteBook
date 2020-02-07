import { Injectable } from '@angular/core';

import { DBaseModule } from '@dbase/dbase.module';
import { FireService } from '@dbase/fire/fire.service';
import { AuthService } from '@service/auth/auth.service';

import { STORE, FIELD } from '@dbase/data/data.define';
import { ETrack, ITrack } from '@service/track/track.define';

import { sprintf } from '@lib/string.library';
import { fix } from '@lib/number.library';
import { getDate } from '@lib/instant.library';
import { dbg } from '@lib/logger.library';

@Injectable({ providedIn: DBaseModule })
export class TrackService {
	private logLevel = ETrack.all;
	private dbg = dbg(this);

	constructor(private fire: FireService, private auth: AuthService) { }

	async write(fmt?: any, ...data: any[]) {
		const now = getDate();
		const uid = await this.auth.current
			.then(user => user && user.uid)

		const trackCol = `/${STORE.log}/${now.yy}${fix(now.mm)}/${fix(now.dd)}` as STORE;
		const trackDoc = {
			[FIELD.store]: STORE.log,
			[FIELD.type]: this.logLevel,
			[FIELD.uid]: uid || 'anonymous',
			[FIELD.stamp]: now.ts,
			date: { year: now.yy, month: now.mm, day: now.dd },
			msg: sprintf(fmt, ...data),
		} as ITrack

		this.dbg('track: %j', trackDoc);
		this.fire.setDoc(trackCol, trackDoc);
	}

	set level(level: ETrack) {
		this.logLevel = level;
	}

	get level() {
		return this.logLevel;
	}
}
