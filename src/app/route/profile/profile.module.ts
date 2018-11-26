import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Routes, RouterModule } from '@angular/router';

import { MaterialModule } from '@route/material.module';
import { PlanComponent } from './plan/plan.component';
import { AccountComponent } from './account/account.component';
import { HistoryComponent } from './history/history.component';

const routes: Routes = [
	{ path: 'plan', component: PlanComponent },
	{ path: 'account', component: AccountComponent },
	{ path: 'history', component: HistoryComponent },
];

@NgModule({
	imports: [CommonModule, MaterialModule, RouterModule.forChild(routes),],
	declarations: [PlanComponent, AccountComponent, HistoryComponent]
})
export class ProfileModule { }
