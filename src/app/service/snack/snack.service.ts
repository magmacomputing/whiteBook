import { Injectable } from '@angular/core';
import { MatSnackBar, MatSnackBarRef } from '@angular/material';

@Injectable({ providedIn: 'root' })
export class SnackService {
  private ref?: MatSnackBarRef<{}>;

  constructor(private snack: MatSnackBar) { }

  public show(msg: string, opts?: Object) {
    this.ref = this.snack.open(msg);
  }

  public close() {
    if (this.ref) {
      this.ref.dismiss();
      this.ref = undefined;
    }
  }
}
