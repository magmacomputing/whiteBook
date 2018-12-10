import { Injectable, Component, Inject } from '@angular/core';
import { MatSnackBar, MatSnackBarRef, MatSnackBarConfig, MAT_SNACK_BAR_DATA } from '@angular/material';

import { MaterialModule } from '@route/material.module';

// Display a Warning icon
@Component({
  selector: 'warning-snackbar',
  template: '<span style="color:orange">Warning: </span>{{ data }}'
})
export class WarnSnackbarComponent {
  constructor(@Inject(MAT_SNACK_BAR_DATA) public data: any) { }
}

@Injectable({ providedIn: MaterialModule })
export class SnackService {
  private ref?: MatSnackBarRef<{}>;

  constructor(public snack: MatSnackBar) { }

  public open(msg: string, action?: string, config: MatSnackBarConfig = {}) {
    this.dismiss();
    this.ref = this.snack.open(msg, action, config);
  }

  public warn(msg: string, action?: string, config: MatSnackBarConfig = {}) {
    this.dismiss();
    console.log('warn: ', msg);

    this.ref = this.snack.openFromComponent(WarnSnackbarComponent, { ...config, data: msg });
  }

  public dismiss() {
    if (this.ref) {
      this.ref.dismiss();
      this.ref = undefined;
    }
  }
}
