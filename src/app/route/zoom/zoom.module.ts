import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Routes, RouterModule } from '@angular/router';

import { MaterialModule } from '@service/material/material.module';
import { ZoomComponent } from './zoom.component';

const routes: Routes = [
	{ path: '**', component: ZoomComponent },
];

@NgModule({
	declarations: [
		ZoomComponent,
	],
	imports: [
		CommonModule,
		MaterialModule,
		RouterModule.forChild(routes),
	],
})
export class ZoomModule { }
