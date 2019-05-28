import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { OAuthComponent } from '@route/login/oauth.component';
import { EMailComponent } from '@route/login/email.component';

@NgModule({
  imports: [CommonModule],
  declarations: [OAuthComponent, EMailComponent],
})
export class LoginModule { }
