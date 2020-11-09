import { Component, OnInit, Input, OnDestroy } from '@angular/core';

import { REACT } from '@dbase/data.define';
import { ReactionService } from '@service/forum/reaction.service';

@Component({
	selector: 'reaction',
	templateUrl: './reaction.component.html',
})
export class ReactionComponent implements OnInit, OnDestroy {

	@Input() itemId!: string;

	showEmojis = false;
	emojiList: REACT[] = [];

	reactionCount!: number;
	userReaction!: REACT;

	subscription: any;

	constructor(private reactionSvc: ReactionService) { }

	ngOnInit() {
		// this.emojiList = this.reactionSvc.emojiList

		// this.subscription = this.reactionSvc.getReaction(this.itemId)
		// 	.subscribe(reactions => {
		// 		this.reactionCount = this.reactionSvc.countReaction(reactions)
		// 		this.userReaction = this.reactionSvc.userReaction(reactions)

		// 	})
	}

	react(val: REACT) {
		if (this.userReaction === val) {
			this.reactionSvc.removeReaction(this.itemId)
		} else {
			this.reactionSvc.updateReaction(this.itemId, val)
		}
	}

	toggleShow() {
		this.showEmojis = !this.showEmojis
	}

	emojiPath(emoji: string) {
		return `assets/reactions/${emoji}.svg`
	}

	hasReactions(index: number) {
		return 0;
		// return _.get(this.reactionCount, index.toString())
	}

	ngOnDestroy() {
		this.subscription.unsubscribe()
	}
}