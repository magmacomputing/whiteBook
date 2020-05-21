import { Component, Injectable, Inject } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef, MatDialogConfig } from '@angular/material/dialog';

import { TString, isArray } from '@library/type.library';
import { dbg } from '@library/logger.library';

@Component({
	selector: 'info-dialog',
	template: `
    <div mat-dialog-title>
      <img [src]="data.image || 'https://source.unsplash.com/random/200x200'" width="100" height="100">
      <h2> {{ data.title }} </h2>
    </div>

    <mat-dialog-content class="mat-typography">
      <h3> <div [innerHTML]="safe(data.subtitle,'html')"></div> </h3><p>
			<div [innerHTML]="safe(data.content, 'html')"></div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <div *ngFor="let btn of data.actions">
        <button mat-button mat-dialog-close>{{ btn }}</button>
      </div>
    </mat-dialog-actions>
  `,
})
export class InfoDialogComponent {
	constructor(protected sanitize: DomSanitizer, private dialogRef: MatDialogRef<InfoDialogComponent>, @Inject(MAT_DIALOG_DATA) public data: any,) { }

	close() {
		this.dialogRef.close();
	}

	safe(value: string, type: string) {
		switch (type) {
			case 'html': return this.sanitize.bypassSecurityTrustHtml(value);
			case 'style': return this.sanitize.bypassSecurityTrustStyle(`linear-gradient(rgba(29, 29, 29, 0), rgba(16, 16, 23, 0.5)), url(${value})`);
			case 'script': return this.sanitize.bypassSecurityTrustScript(value);
			case 'url': return this.sanitize.bypassSecurityTrustUrl(value);
			case 'resourceUrl': return this.sanitize.bypassSecurityTrustResourceUrl(value);
			default: throw new Error(`Invalid safe type specified: ${type}`);
		}
	}
}

interface openDialog {
	content: TString;
	image?: string;
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
		if (config.data.content)
			config.data.content = (isArray(config.data.content) ? config.data.content.join('') : config.data.content)
				.replace(/\t/g, '')
				.replace(/\n/g, '')

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
