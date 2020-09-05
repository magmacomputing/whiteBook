import { Injectable } from '@angular/core';

import { DataService } from '@dbase/data/data.service';
import { React, StoreMeta, Comment, TStoreBase } from '@dbase/data/data.schema';
import { FIELD, STORE, REACT, COLLECTION } from '@dbase/data/data.define';

import { ForumArgs, CommentArgs, ReactArgs } from '@service/forum/forum.define';
import { addWhere } from '@dbase/fire/fire.library';

import { Instant, getDate } from '@library/instant.library';

@Injectable({ providedIn: 'root' })
export class ForumService {

	constructor(private data: DataService) { }

	async setReact({ key, type = STORE.schedule, track, date, uid, react = REACT.like, }: ReactArgs) {
		const now = getDate(date);
		const reactDoc = await this.getForum<React>({ store: STORE.react, key, type, date });

		const creates: StoreMeta[] = [];
		const updates: StoreMeta[] = [];
		const deletes: StoreMeta[] = [];

		switch (true) {
			case reactDoc.length && react === REACT.none:					// delete the old React
				deletes.push({ ...reactDoc[0] });
				break;

			case reactDoc.length && react === reactDoc[0].react:	// React has not changed
			case react === REACT.none:														// or no React
				break;																							// nothing to change

			case reactDoc.length > 0:															// update the React
				updates.push({ ...reactDoc[0], stamp: now.ts, react });
				break;

			default:																							// create the React
				const forum = await this.newForum<React>({ store: STORE.react, key, type, track, date, uid });
				creates.push({ ...forum, react });
		}

		return this.data.batch(creates, updates, deletes);
	}

	async setComment({ key, type = STORE.schedule, track, date, uid, comment = '', }: CommentArgs) {
		return comment === ''
			? undefined
			: this.newForum<Comment>({ store: STORE.comment, key, type, track, date, uid })
				.then(forum => this.data.setDoc(STORE.comment, { ...forum, comment } as TStoreBase))
	}

	/** create a Forum base */
	private async newForum<T extends Comment | React>({ store, key, type, track, date, uid }: ForumArgs) {
		const now = getDate(date);

		const forum = {
			[FIELD.store]: store,
			[FIELD.type]: type,																		// the Store type related to this comment
			[FIELD.key]: key,																			// the Store key related to this comment
			[FIELD.stamp]: now.ts,
			[FIELD.uid]: uid || await this.getUid(),
			track: {
				[FIELD.date]: now.format(Instant.FORMAT.yearMonthDay),
			},
		} as T

		if (track)
			Object.entries(track)																	// additional info to track
				.forEach(([key, value]) => forum.track[key] = value)

		return forum;
	}

	// get all Forum content for a date, optionally for a named Store-type and named Store-key
	public async getForum<T>({ store, key, type, date, uid }: Partial<ForumArgs> = {}) {
		const now = getDate(date);

		const forumFilter = [
			addWhere(FIELD.uid, uid || await this.getUid()),
			addWhere(`track.${FIELD.date}`, now.format(Instant.FORMAT.yearMonthDay)),
		]
		if (store)
			forumFilter.push(addWhere(FIELD.store, store));
		if (key)
			forumFilter.push(addWhere(FIELD.key, key));
		if (type)
			forumFilter.push(addWhere(FIELD.type, type));

		return this.data.getFire<T>(COLLECTION.forum, { where: forumFilter });
	}

	private getUid() {
		return this.data.auth.current
			.then(user => user && user.uid)
	}
}
