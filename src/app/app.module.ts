import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { RoutingModule } from '@route/routing.module';
import { AppComponent } from './app.component';
import { DBaseModule } from '@app/dbase/dbase.module';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    RoutingModule,
    DBaseModule,
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
