import { NgModule, Injector } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ServiceWorkerModule } from '@angular/service-worker';

import { RoutingModule } from '@route/route.module';
import { DBaseModule } from '@dbase/dbase.module';
import { AuthModule } from '@service/auth/auth.module';
import { AppComponent } from './app.component';

import { NgxsModule } from '@ngxs/store';
import { NgxsStoragePluginModule } from '@ngxs/storage-plugin';

import { StoreStorage } from '@dbase/sync/sync.define';
import { environment } from '../environments/environment';
import { InfoSnackBar, WarnSnackBar, ErrorSnackBar } from '@service/material/snack.service';

@NgModule({
	declarations: [
		AppComponent,
	],
	imports: [
		NgxsModule.forRoot([], { developmentMode: !environment.production }),
		NgxsStoragePluginModule.forRoot({ key: StoreStorage }),
		BrowserModule,
		DBaseModule,
		AuthModule,
		RoutingModule,
		BrowserAnimationsModule,
		ServiceWorkerModule.register('ngsw-worker.js', { enabled: environment.production }),
	],
	providers: [],
	bootstrap: [AppComponent],
	entryComponents: [InfoSnackBar, WarnSnackBar, ErrorSnackBar],
})
export class AppModule {
	static injector: Injector;

	constructor(injector: Injector) {
		AppModule.injector = injector;					// allow for retrieving singletons using AppModule.injector.get(MyService)
	}
}
