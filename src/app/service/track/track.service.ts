import { Injectable } from '@angular/core';

import { DBaseModule } from '@dbase/dbase.module';
import { FireService } from '@dbase/fire/fire.service';
import { AuthService } from '@service/auth/auth.service';

import { STORE, FIELD } from '@dbase/data/data.define';
import { ETrack, ITrack } from '@service/track/track.define';

import { fix } from '@lib/number.library';
import { getDate } from '@lib/date.library';
import { dbg, sprintf } from '@lib/logger.library';

@Injectable({ providedIn: DBaseModule })
export class TrackService {
	private logLevel = ETrack.all;
	private dbg = dbg(this);

	constructor(private fire: FireService, private auth: AuthService) { }

	async write(fmt?: any, ...data: any[]) {
		const now = getDate();
		const uid = await this.auth.current
			.then(user => user && user.uid)

		const trackCol = `/${STORE.log}/${now.yy}${fix(now.mm)}/${fix(now.dd)}`;
		const trackDoc: ITrack = {
			[FIELD.store]: STORE.log,
			[FIELD.type]: this.logLevel,
			[FIELD.uid]: uid || 'anonymous',
			stamp: now.ts,
			date: { year: now.yy, month: now.mm, day: now.dd },
			msg: sprintf(fmt, ...data),
		}

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
