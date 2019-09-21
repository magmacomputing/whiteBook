import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Routes, RouterModule } from '@angular/router';

import { MaterialModule } from '@service/material/material.module';
import { PlanComponent } from '@route/profile/plan/plan.component';
import { AccountComponent } from '@route/profile/account/account.component';
import { HistoryComponent } from '@route/profile/history/history.component';

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
