import { Injectable } from '@angular/core';
import { DataService } from '@dbase/data/data.service';
import { IForumBase, IReact, IStoreMeta } from '@dbase/data/data.schema';
import { FIELD, STORE, REACT, COLLECTION } from '@dbase/data/data.define';
import { addWhere } from '@dbase/fire/fire.library';
import { DATE_FMT, TDate, getDate } from '@lib/date.library';

@Injectable({ providedIn: 'root' })
export class ForumService {

	constructor(private data: DataService) { }

	async setReact({ key, react = REACT.like, type = STORE.schedule, info, dt }: { key: string; react?: REACT; type?: STORE; info?: { [key: string]: string | number }; dt?: TDate; }) {
		const now = getDate(dt);
		const when = now.format(DATE_FMT.yearMonthDay);
		const reactDoc = await this.getReact({ key, type, when });

		const creates: IStoreMeta[] = [];
		const updates: IStoreMeta[] = [];
		const deletes: IStoreMeta[] = [];

		switch (true) {
			case reactDoc.length && react === REACT.none:					// delete the old React
				deletes.push({ ...reactDoc[0] });
				break;

			case reactDoc.length > 0:															// update the React
				updates.push({ ...reactDoc[0], stamp: now.ts, react });
				break;

			default:																							// create the React
				const forum = {
					[FIELD.store]: STORE.react,
					[FIELD.type]: type,
					[FIELD.uid]: await this.getUid(),
					[FIELD.key]: key,
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

	setComment() {

	}

	public async getReact({ key, type, when }: { key?: string; type?: STORE; when: number; }) {
		return this.getForum<IReact>(when)
			.then(forum => forum.filter(react => react[FIELD.store] === STORE.react))
			.then(forum => forum.filter(react => react[FIELD.type] === type))
			.then(forum => forum.filter(react => react[FIELD.key] === key))
	}

	// get all Forum content for a date
	public async getForum<T>(dt?: TDate) {
		const now = getDate(dt);

		const forumFilter = [
			addWhere(FIELD.uid, await this.getUid()),
			addWhere(`track.${FIELD.date}`, now.format(DATE_FMT.yearMonthDay)),
		]

		return this.data.getFire<T>(COLLECTION.forum, { where: forumFilter });
	}

	private getUid() {
		return this.data.auth.current
			.then(user => user && user.uid)
	}
}
