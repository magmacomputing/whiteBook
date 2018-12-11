import { Injectable, Component, Inject } from '@angular/core';
import { MatSnackBar, MatSnackBarRef, MatSnackBarConfig, MAT_SNACK_BAR_DATA } from '@angular/material';

import { MaterialModule } from '@route/material.module';

// TODO: Display an Info icon
@Component({
  selector: 'info-snackbar',
  template: '<span style="color:green">Note: </span>{{ data }}'
})
export class InfoSnackbarComponent {
  constructor(@Inject(MAT_SNACK_BAR_DATA) public data: any) { }
}
// TODO: Display a Warning icon
@Component({
  selector: 'warning-snackbar',
  template: '<span style="color:orange">Warning: </span>{{ data }}'
})
export class WarnSnackbarComponent {
  constructor(@Inject(MAT_SNACK_BAR_DATA) public data: any) { }
}
// TODO: Display an Error icon
@Component({
  selector: 'error-snackbar',
  template: '<span style="color:red">Error: </span>{{ data }}'
})
export class ErrorSnackbarComponent {
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

  public info(msg: string, action?: string, config: MatSnackBarConfig = {}) {
    this.dismiss();
    this.ref = this.snack.openFromComponent(InfoSnackbarComponent, { ...config, data: msg });
  }

  public warn(msg: string, action?: string, config: MatSnackBarConfig = {}) {
    this.dismiss();
    this.ref = this.snack.openFromComponent(WarnSnackbarComponent, { ...config, data: msg });
  }

  public error(msg: string, action?: string, config: MatSnackBarConfig = {}) {
    this.dismiss();
    this.ref = this.snack.openFromComponent(ErrorSnackbarComponent, { ...config, data: msg });
  }

  public dismiss() {                    // dismiss any snackbar, if present
    if (this.ref) {
      this.ref.dismiss();
      this.ref = undefined;
    }
  }
}
