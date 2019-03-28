import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule} from '@angular/common/http';
import { Routes, RouterModule } from '@angular/router';

import { MaterialModule } from '@route/material.module';
import { MigAttendComponent } from '@route/migrate/attend/mig-attend.component';
import { MigEventComponent } from './event/mig-event.component';

const routes: Routes = [
  { path: 'migAttend', component: MigAttendComponent },
];

@NgModule({
  declarations: [
    MigAttendComponent,
    MigEventComponent,
  ],
  imports: [
    CommonModule, MaterialModule, RouterModule.forChild(routes), HttpClientModule,
  ]
})
export class MigrateModule { }
