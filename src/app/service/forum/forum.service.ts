import { Injectable } from '@angular/core';

import { DataService } from '@dbase/data/data.service';
import { IReact, IStoreMeta, IComment } from '@dbase/data/data.schema';
import { FIELD, STORE, REACT, COLLECTION } from '@dbase/data/data.define';

import { addWhere } from '@dbase/fire/fire.library';

import { DATE_FMT, TDate, getDate } from '@lib/date.library';
import { TString, isUndefined } from '@lib/type.library';

@Injectable({ providedIn: 'root' })
export class ForumService {

	constructor(private data: DataService) { }

	async setReact({ key, react = REACT.like, store = STORE.schedule, info, date }: { key: string; react?: REACT; store?: STORE; info?: { [key: string]: string | number }; date?: TDate; }) {
		const now = getDate(date);
		const when = now.format(DATE_FMT.yearMonthDay);
		const reactDoc = await this.getForum<IReact>({ key, store, date });

		const creates: IStoreMeta[] = [];
		const updates: IStoreMeta[] = [];
		const deletes: IStoreMeta[] = [];

		switch (true) {
			case reactDoc.length && react === REACT.none:					// delete the old React
				deletes.push({ ...reactDoc[0] });
				break;

			case reactDoc.length && react === reactDoc[0].react:
				break;																							// nothing to change

			case reactDoc.length > 0:															// update the React
				updates.push({ ...reactDoc[0], stamp: now.ts, react });
				break;

			default:																							// create the React
				const forum = {
					[FIELD.store]: STORE.react,
					[FIELD.type]: store,															// the Store type related to this comment
					[FIELD.key]: key,																	// the Store key related to this comment					
					[FIELD.uid]: await this.getUid(),
					[FIELD.stamp]: now.ts,
					track: {
						[FIELD.date]: when,
					},
					react,
				} as unknown as IReact

				if (info) {
					Object.entries(info)															// additional info to track
						.forEach(([key, value]) => forum.track[key] = value)
				}

				creates.push(forum);
		}

		return this.data.batch(creates, updates, deletes);
	}

	// TODO: clean-up any comments (by cloud-function)?
	async setComment({ key, store, info, date, comment }: { key: string, store: STORE, info?: { [key: string]: string | number }; comment: TString; date?: TDate; }) {
		if (isUndefined(comment))
			return undefined;

		const now = getDate(date);
		const creates: IStoreMeta[] = [];												// only creates[] is currently used
		const updates: IStoreMeta[] = [];												// we dont allow comment updates
		const deletes: IStoreMeta[] = [];												// we dont allow comment deletes

		const forum = {
			[FIELD.store]: STORE.comment,
			[FIELD.type]: store,																	// the Store type related to this comment
			[FIELD.key]: key,																			// the Store key related to this comment
			[FIELD.uid]: await this.getUid(),
			[FIELD.stamp]: now.ts,
			track: {
				[FIELD.date]: now.format(DATE_FMT.yearMonthDay),
			},
			comment,
		} as unknown as IComment

		if (info)
			Object.entries(info)																	// additional info to track
				.forEach(([key, value]) => forum.track[key] = value)
		creates.push(forum);

		return this.data.batch(creates, updates, deletes);
	}

	// get all Forum content for a date, optionally for a named Store-type and named Store-key
	public async getForum<T>({ key, store, date }: { key?: string; store?: STORE; date?: TDate; } = {}) {
		const now = getDate(date);

		const forumFilter = [
			addWhere(FIELD.uid, await this.getUid()),
			addWhere(`track.${FIELD.date}`, now.format(DATE_FMT.yearMonthDay)),
		]
		if (key)
			forumFilter.push(addWhere(FIELD.key, key))
		if (store)
			forumFilter.push(addWhere(FIELD.type, store))

		return this.data.getFire<T>(COLLECTION.forum, { where: forumFilter });
	}

	private getUid() {
		return this.data.auth.current
			.then(user => user && user.uid)
	}
}
