import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Routes, RouterModule } from '@angular/router';

import { MaterialModule } from '@route/material.module';
import { PlanComponent } from './plan/plan.component';

const routes: Routes = [
  { path: 'plan', component: PlanComponent },
];

@NgModule({
  imports: [CommonModule, MaterialModule, RouterModule.forChild(routes),],
  declarations: [PlanComponent]
})
export class ProfileModule { }
