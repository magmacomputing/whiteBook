import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Routes, RouterModule } from '@angular/router';

import { MaterialModule } from '@service/material/material.module';
import { AdminComponent } from './admin.component';
import { Auth } from '@dbase/data.define';

const routes: Routes = [
	{ path: Auth.ROLE.admin, component: AdminComponent },
];

@NgModule({
	imports: [
		CommonModule,
		MaterialModule,
		RouterModule.forChild(routes),
	],
	declarations: [AdminComponent]
})
export class AdminModule { }
