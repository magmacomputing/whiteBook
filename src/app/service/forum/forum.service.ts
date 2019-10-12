import { Injectable } from '@angular/core';

import { DataService } from '@dbase/data/data.service';
import { IReact, IStoreMeta, IComment } from '@dbase/data/data.schema';
import { FIELD, STORE, REACT, COLLECTION } from '@dbase/data/data.define';

import { IForumArgs, ICommentArgs, IReactArgs } from '@service/forum/forum.define';
import { addWhere } from '@dbase/fire/fire.library';

import { DATE_FMT, TDate, getDate } from '@lib/date.library';
import { isUndefined } from '@lib/type.library';

@Injectable({ providedIn: 'root' })
export class ForumService {

	constructor(private data: DataService) { }

	async setReact({ key, react = REACT.like, type = STORE.schedule, info, date }: IReactArgs) {
		const now = getDate(date);
		const reactDoc = await this.getForum<IReact>({ key, type, date });

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
				const forum = await this.newForum(STORE.react, { key, type, info, date });
				creates.push({ ...forum, react });
		}

		return this.data.batch(creates, updates, deletes);
	}

	// TODO: clean-up any comments (by cloud-function)?
	async setComment({ key, type, info, date, comment }: ICommentArgs) {
		if (isUndefined(comment) || comment === '')
			return undefined;

		const creates: IStoreMeta[] = [];												// only creates[] is currently used
		const updates: IStoreMeta[] = [];												// we dont allow comment updates
		const deletes: IStoreMeta[] = [];												// we dont allow comment deletes

		const forum = await this.newForum<IComment>(STORE.comment, { key, type, info, date });
		creates.push({ ...forum, comment });

		return this.data.batch(creates, updates, deletes);
	}

	/** create a Forum base */
	private async newForum<T extends IComment | IReact>(store: string, { key, type, info, date }: IForumArgs) {
		const now = getDate(date);

		const forum = {
			[FIELD.store]: store,
			[FIELD.type]: type,																	// the Store type related to this comment
			[FIELD.key]: key,																			// the Store key related to this comment
			[FIELD.uid]: await this.getUid(),
			[FIELD.stamp]: now.ts,
			track: {
				[FIELD.date]: now.format(DATE_FMT.yearMonthDay),
			},
		} as unknown as T

		if (info)
			Object.entries(info)																	// additional info to track
				.forEach(([key, value]) => forum.track[key] = value)

		return forum;
	}

	// get all Forum content for a date, optionally for a named Store-type and named Store-key
	public async getForum<T>({ key, type, date }: { key?: string; type?: STORE; date?: TDate; } = {}) {
		const now = getDate(date);

		const forumFilter = [
			addWhere(FIELD.uid, await this.getUid()),
			addWhere(`track.${FIELD.date}`, now.format(DATE_FMT.yearMonthDay)),
		]
		if (key)
			forumFilter.push(addWhere(FIELD.key, key))
		if (type)
			forumFilter.push(addWhere(FIELD.type, type))

		return this.data.getFire<T>(COLLECTION.forum, { where: forumFilter });
	}

	private getUid() {
		return this.data.auth.current
			.then(user => user && user.uid)
	}
}
