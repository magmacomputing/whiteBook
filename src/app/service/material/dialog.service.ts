import { Component, Injectable, Inject } from '@angular/core';
import { MatDialog, MatDialogRef, MatDialogConfig, MAT_DIALOG_DATA } from '@angular/material';

// TODO: Display an Info icon
@Component({
  selector: 'info-dialog',
  template: '<span style="color:green">Note: </span>{{ data }}'
})
export class InfoDialogComponent {
  constructor(@Inject(MAT_DIALOG_DATA) public data: any) { }
}

@Injectable({ providedIn: 'root' })
export class DialogService {
	private ref?: MatDialogRef<{}>;

  constructor(private dialog: MatDialog) { }

  public open(msg: string, action?: string, config: MatDialogConfig = {}) {
		this.dismiss();
		this.ref = this.dialog.open(InfoDialogComponent, config);
    // this.ref = this.snack.open(msg, action, this.setConfig(config));
  }
	
	public dismiss() {                    // dismiss any snackbar, if present
    if (this.ref) {
      // this.ref.dismiss();
      this.ref = undefined;
		}
	}
}
