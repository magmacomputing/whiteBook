import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AboutComponent } from './about.component';

const routes: Routes = [
	{ path: '**', component: AboutComponent },
];

@NgModule({
	declarations: [AboutComponent],
	imports: [
		CommonModule,
		RouterModule.forChild(routes),
	]
})
export class AboutModule { }
