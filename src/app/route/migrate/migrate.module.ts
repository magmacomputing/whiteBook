import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Routes, RouterModule } from '@angular/router';

import { MigAttendComponent } from '@route/migrate/attend/mig-attend.component';
import { MaterialModule } from '@route/material.module';

const routes: Routes = [
  { path: 'migAttend', component: MigAttendComponent },
];

@NgModule({
  declarations: [MigAttendComponent,],
  imports: [
    CommonModule, MaterialModule, RouterModule.forChild(routes),
  ]
})
export class MigrateModule { }
