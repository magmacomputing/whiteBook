import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Routes, RouterModule } from '@angular/router';

import { MaterialModule } from '@route/material.module';
import { MigAttendComponent } from '@route/migrate/attend/migAttend.component';

const routes: Routes = [
	// { path: 'profile', component: MigProfileComponent },
	// { path: 'payment', component: MigPaymentComponent },
	{ path: 'migAttend', component: MigAttendComponent },
];

@NgModule({
	imports: [CommonModule, MaterialModule, RouterModule.forChild(routes),],
	declarations: [MigAttendComponent],
})
export class MigrateModule { }
