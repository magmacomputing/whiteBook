import { Injectable } from '@angular/core';

import { DBaseModule } from '@dbase/dbase.module';
import { DataService } from '@dbase/data/data.service';
import { STORE, REACT } from '@dbase/data.define';

import { isString } from '@library/type.library';
import { dbg } from '@library/logger.library';

@Injectable({ providedIn: DBaseModule })
export class ReactionService {
	#dbg = dbg(this);

	userId!: string;
	emojiList = Object.values(REACT).filter(isString)

	constructor(private data: DataService) {
		this.data.getCurrentUser()
			.then(uid => this.userId = uid);
	}

	getReaction(itemId: string, store = STORE.Attend) {
		return [REACT.Like];
	}

	updateReaction(itemId: string, reaction: REACT = REACT.Like) {
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

	userReaction(reactions: REACT[]) {
		return REACT.Like;
		// return _.get(reactions, this.userId)
	}

}