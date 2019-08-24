import { Component, Injectable, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef, MatDialogConfig } from '@angular/material/dialog';

import { dbg } from '@lib/logger.library';
import { TString } from '@lib/type.library';

@Component({
  selector: 'info-dialog',
  template: `
    <div mat-dialog-title>
      <img [src]="data.icon || 'https://source.unsplash.com/random/200x200'">
      <h2> {{ data.title }} </h2>
    </div>

    <mat-dialog-content class="mat-typography">
      <h3> {{ data.subtitle }} </h3><p>
      <div *ngFor="let content of data.content">
        {{ content }}
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <div *ngFor="let btn of data.actions">
        <button mat-button mat-dialog-close>{{ btn }}</button>
      </div>
    </mat-dialog-actions>
  `,
})
export class InfoDialogComponent {
  constructor(private dialogRef: MatDialogRef<InfoDialogComponent>, @Inject(MAT_DIALOG_DATA) public data: any, ) { }

  close() {
    this.dialogRef.close();
  }
}

interface openDialog {
  content: TString;
  icon?: string;
  title?: string;
  subtitle?: string;
  actions?: string[];
}

@Injectable({ providedIn: 'root' })
export class DialogService {
  private ref?: MatDialogRef<{}>;
  private dbg = dbg(this);

  constructor(private dialog: MatDialog) { }

  public open(data: openDialog, config: MatDialogConfig = {}) {
    config.data = data;

    this.dismiss();
    this.ref = this.dialog.open(InfoDialogComponent, config);
  }

  public dismiss() {                    // dismiss any MatDialog, if present
    if (this.ref) {
      this.ref.close();
      this.ref = undefined;
    }
  }
}
