import { Injectable } from '@angular/core';

import { DataService } from '@dbase/data/data.service';
import { IReact, IStoreMeta, IComment, TStoreBase } from '@dbase/data/data.schema';
import { FIELD, STORE, REACT, COLLECTION } from '@dbase/data/data.define';

import { IForumArgs, ICommentArgs, IReactArgs } from '@service/forum/forum.define';
import { addWhere } from '@dbase/fire/fire.library';

import { DATE_FMT, getDate } from '@lib/date.library';

@Injectable({ providedIn: 'root' })
export class ForumService {

	constructor(private data: DataService) { }

	async setReact({ key, type = STORE.schedule, info, date, uid, react = REACT.like, }: IReactArgs) {
		const now = getDate(date);
		const reactDoc = await this.getForum<IReact>({ store: STORE.react, key, type, date });

		const creates: IStoreMeta[] = [];
		const updates: IStoreMeta[] = [];
		const deletes: IStoreMeta[] = [];

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
				const forum = await this.newForum<IReact>({ store: STORE.react, key, type, info, date, uid });
				creates.push({ ...forum, react });
		}

		return this.data.batch(creates, updates, deletes);
	}

	// TODO: clean-up any comments (by cloud-function)?
	async setComment({ key, type = STORE.schedule, info, date, uid, comment = '', }: ICommentArgs) {
		return comment === ''
			? undefined
			: this.newForum<IComment>({ store: STORE.comment, key, type, info, date, uid })
				.then(forum => this.data.setDoc(STORE.comment, { ...forum, comment } as TStoreBase))
	}

	/** create a Forum base */
	private async newForum<T extends IComment | IReact>({ store, key, type, info, date, uid }: IForumArgs) {
		const now = getDate(date);

		const forum = {
			[FIELD.store]: store,
			[FIELD.type]: type,																		// the Store type related to this comment
			[FIELD.key]: key,																			// the Store key related to this comment
			[FIELD.stamp]: now.ts,
			[FIELD.uid]: uid || await this.getUid(),
			track: {
				[FIELD.date]: now.format(DATE_FMT.yearMonthDay),
			},
		} as T

		if (info)
			Object.entries(info)																	// additional info to track
				.forEach(([key, value]) => forum.track[key] = value)

		return forum;
	}

	// get all Forum content for a date, optionally for a named Store-type and named Store-key
	public async getForum<T>({ store, key, type, date, uid }: Partial<IForumArgs> = {}) {
		const now = getDate(date);

		const forumFilter = [
			addWhere(FIELD.uid, uid || await this.getUid()),
			addWhere(`track.${FIELD.date}`, now.format(DATE_FMT.yearMonthDay)),
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
