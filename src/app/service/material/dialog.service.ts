import { Component, Injectable, Inject } from '@angular/core';
import { MatDialog, MatDialogRef, MatDialogConfig, MAT_DIALOG_DATA } from '@angular/material';

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
  }
	
	public dismiss() {                    // dismiss any snackbar, if present
    if (this.ref) {
      this.ref = undefined;
		}
	}
}
