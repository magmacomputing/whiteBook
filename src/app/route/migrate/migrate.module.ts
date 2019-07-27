import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule} from '@angular/common/http';
import { Routes, RouterModule } from '@angular/router';

import { MaterialModule } from '@route/material.module';
import { MigrateComponent } from '@route/migrate/migrate.component';

const routes: Routes = [
  { path: '**', component: MigrateComponent },
];

@NgModule({
  declarations: [
    MigrateComponent,
  ],
  imports: [
    CommonModule, MaterialModule, HttpClientModule, RouterModule.forChild(routes),
  ]
})
export class MigrateModule { }
