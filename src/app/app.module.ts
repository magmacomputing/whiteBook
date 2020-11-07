import { NgModule, Injector } from '@angular/core';
import { BrowserModule, HammerModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { RoutingModule } from '@route/router/route.module';
import { DBaseModule } from '@dbase/dbase.module';
import { AuthModule } from '@service/auth/auth.module';
import { MaterialModule } from '@service/material/material.module';
import { AppComponent } from './app.component';

import { NgxsModule } from '@ngxs/store';
import { NgxsStoragePluginModule } from '@ngxs/storage-plugin';

import { SafePipe } from '@service/material/safe.pipe';

import { Storage } from '@library/browser.library';
import { environment } from '../environments/environment';

@NgModule({
	declarations: [
		AppComponent,
		SafePipe,
	],
	imports: [
		NgxsModule.forRoot([], { developmentMode: !environment.production }),
		NgxsStoragePluginModule.forRoot({ key: Storage.State }),
		BrowserModule,
		HammerModule,
		DBaseModule,
		AuthModule,
		RoutingModule,
		MaterialModule,
		BrowserAnimationsModule,
	],
	providers: [],
	bootstrap: [AppComponent],
})
export class AppModule {
	static injector: Injector;

	constructor(injector: Injector) {
		AppModule.injector = injector;					// allow for retrieving singletons using AppModule.injector.get(MyService)
	}
}
