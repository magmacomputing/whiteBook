import { Component, OnInit } from '@angular/core';

import { DataService } from '@dbase/data/data.service';
import { ForumService } from '@service/forum/forum.service';
import { ReactionService } from '@service/forum/reaction.service';

@Component({
	selector: 'wb-forum',
	templateUrl: './forum.component.html',
})
export class ForumComponent implements OnInit {

	constructor(private forum: ForumService, private react: ReactionService, private data: DataService) { }

	ngOnInit() { }

}
