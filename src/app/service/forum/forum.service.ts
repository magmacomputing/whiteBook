import { Injectable } from '@angular/core';

import { DataService } from '@dbase/data/data.service';
import { FireDocument, React, Comment } from '@dbase/data.schema';
import { FIELD, STORE, REACT, COLLECTION } from '@dbase/data.define';

import { ForumArgs, CommentArgs, ReactArgs } from '@service/forum/forum.define';
import { Fire } from '@dbase/fire/fire.library';

import { Instant, getInstant } from '@library/instant.library';

@Injectable({ providedIn: 'root' })
export class ForumService {

	constructor(private data: DataService) { }

	async setReact({ key, type = STORE.Schedule, track, date, uid, react = REACT.Like, }: ReactArgs) {
		const now = getInstant(date);
		const reactDoc = await this.getForum<React>({ store: STORE.React, key, type, date });

		const creates: FireDocument[] = [];
		const updates: FireDocument[] = [];
		const deletes: FireDocument[] = [];

		switch (true) {
			case reactDoc.length && react === REACT.None:					// delete the old React
				deletes.push({ ...reactDoc[0] });
				break;

			case reactDoc.length && react === reactDoc[0].react:	// React has not changed
			case react === REACT.None:														// or no React
				break;																							// nothing to change

			case reactDoc.length > 0:															// update the React
				updates.push({ ...reactDoc[0], stamp: now.ts, react });
				break;

			default:																							// create the React
				const forum = await this.newForum<React>({ store: STORE.React, key, type, track, date, uid });
				creates.push({ ...forum, react });
		}

		return this.data.batch(creates, updates, deletes);
	}

	async setComment({ key, type = STORE.Schedule, track, date, uid, comment = '', }: CommentArgs) {
		return comment === ''
			? undefined
			: this.newForum<Comment>({ store: STORE.Comment, key, type, track, date, uid })
				.then(forum => this.data.setDoc({ ...forum, comment }))
	}

	/** create a Forum base */
	private async newForum<T extends Comment | React>({ store, key, type, track, date, uid }: ForumArgs) {
		const now = getInstant(date);

		const forum = {
			[FIELD.Store]: store,
			[FIELD.Type]: type,																		// the Store type related to this comment
			[FIELD.Key]: key,																			// the Store key related to this comment
			[FIELD.Stamp]: now.ts,
			[FIELD.Uid]: uid || await this.getUid(),
			track: {
				[FIELD.Date]: now.format(Instant.FORMAT.yearMonthDay),
			},
		} as T

		if (track)
			Object.entries(track)																	// additional info to track
				.forEach(([key, value]) => forum.track[key] = value)

		return forum;
	}

	// get all Forum content for a date, optionally for a named Store-type and named Store-key
	public async getForum<T>({ store, key, type, date, uid }: Partial<ForumArgs> = {}) {
		const now = getInstant(date);

		const forumFilter = [
			Fire.addWhere(FIELD.Uid, uid || await this.getUid()),
			Fire.addWhere(`track.${FIELD.Date}`, now.format(Instant.FORMAT.yearMonthDay)),
		]
		if (store)
			forumFilter.push(Fire.addWhere(FIELD.Store, store));
		if (key)
			forumFilter.push(Fire.addWhere(FIELD.Key, key));
		if (type)
			forumFilter.push(Fire.addWhere(FIELD.Type, type));

		return this.data.select<T>(COLLECTION.Forum, { where: forumFilter });
	}

	private getUid() {
		return this.data.auth.current
			.then(user => user && user.uid)
	}
}
