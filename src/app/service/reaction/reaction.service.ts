import { Injectable } from '@angular/core';

import { DBaseModule } from '@dbase/dbase.module';
import { DataService } from '@dbase/data/data.service';
import { STORE, REACT } from '@dbase/data/data.define';

import { dbg } from '@lib/logger.library';

@Injectable({ providedIn: DBaseModule })
export class ReactionService {
	private dbg = dbg(this);

	userId!: string;
	emojiList = ['like', 'love', 'wow', 'haha', 'sad', 'angry']

	constructor(private data: DataService) {
		this.data.getUID()
			.then(uid => this.userId = uid);
	}

	getReaction(itemId: string, store = STORE.attend) {
		return [REACT.like];
	}

	updateReaction(itemId: string, reaction: REACT = REACT.like) {
		const data = { [this.userId]: reaction }
		// this.db.object(`reactions/${itemId}`).update(data)
	}

	removeReaction(itemId: string) {
		// this.db.object(`reactions/${itemId}/${this.userId}`).remove()
	}

	countReaction(reactions: number[]) {
		return 0;
		// return _.mapValues(_.groupBy(reactions), 'length')
	}

	userReaction(reactions: Array<REACT>) {
		return REACT.like;
		// return _.get(reactions, this.userId)
	}

}