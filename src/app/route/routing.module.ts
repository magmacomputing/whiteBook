import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { Routes, RouterModule } from '@angular/router';
import { LoginComponent } from '@route/login/login.component';

const routes: Routes = [
	{ path: 'login', component: LoginComponent },
	// { path: 'login/oauth', component: OAuthComponent },
	// { path: 'checkin', component: CheckinComponent, canActivate: [AuthGuard] },
];

@NgModule({
	imports: [CommonModule, RouterModule.forRoot(routes)],
	exports: [RouterModule],
	declarations: [LoginComponent]
})
export class RoutingModule { }
