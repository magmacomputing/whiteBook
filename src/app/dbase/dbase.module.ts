import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { NgxsModule } from '@ngxs/store';
import { ClientState } from '@state/client.state';

import { AngularFireModule } from 'angularfire2';
import { AngularFirestoreModule } from 'angularfire2/firestore';
import { environment } from '@env/environment';

const fb = environment.firebase || {};

@NgModule({
  imports: [
    CommonModule,
    NgxsModule.forFeature([ClientState]),
    AngularFireModule.initializeApp(fb.app, fb.config),
    AngularFirestoreModule.enablePersistence(),
  ],
  declarations: []
})
export class DBaseModule { }
