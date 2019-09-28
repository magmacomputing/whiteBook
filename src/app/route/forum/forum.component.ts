import { Component, OnInit } from '@angular/core';

import { ForumService } from '../../service/forum/forum.service';
import { DataService } from '@dbase/data/data.service';

@Component({
	selector: 'wb-forum',
	templateUrl: './forum.component.html',
})
export class ForumComponent implements OnInit {

	constructor(private forum: ForumService, private data: DataService) { }

	ngOnInit() { }

}
