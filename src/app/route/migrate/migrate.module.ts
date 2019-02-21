import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule} from '@angular/common/http';
import { Routes, RouterModule } from '@angular/router';

import { MaterialModule } from '@route/material.module';
import { MigAttendComponent } from '@route/migrate/attend/mig-attend.component';

const routes: Routes = [
  { path: 'migAttend', component: MigAttendComponent },
];

@NgModule({
  declarations: [
    MigAttendComponent,
  ],
  imports: [
    CommonModule, MaterialModule, RouterModule.forChild(routes), HttpClientModule,
  ]
})
export class MigrateModule { }
