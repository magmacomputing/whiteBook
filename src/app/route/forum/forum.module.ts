import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Routes, RouterModule } from '@angular/router';

import { MaterialModule } from '@service/material/material.module';
import { ForumComponent } from './forum.component';
import { ReactionComponent } from '@route/forum/reaction.component';

const routes: Routes = [
	{ path: 'forum', component: ForumComponent },
];

@NgModule({
	imports: [
		CommonModule,
		MaterialModule,
		RouterModule.forChild(routes),
	],
	declarations: [ForumComponent, ReactionComponent]
})
export class ForumModule { }
