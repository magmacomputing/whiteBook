import { Injectable, Component, Inject, NgZone } from '@angular/core';
import { MAT_SNACK_BAR_DATA, MatSnackBar, MatSnackBarConfig, MatSnackBarRef, SimpleSnackBar } from '@angular/material/snack-bar';

import { MaterialModule } from '@service/material/material.module';

import { lprintf } from '@library/logger.library';
import { getCaller } from '@library/utility.library';

// TODO: Display an Info icon
@Component({
	selector: 'info-snackbar',
	template: '<span style="color:green">Note: </span>{{ data }}'
})
export class InfoSnackBar {
	constructor(@Inject(MAT_SNACK_BAR_DATA) public data: any) { }
}
// TODO: Display a Warning icon
@Component({
	selector: 'warning-snackbar',
	template: '<span style="color:orange">Warning: </span>{{ data }}'
})
export class WarnSnackBar {
	constructor(@Inject(MAT_SNACK_BAR_DATA) public data: any) { }
}
// TODO: Display an Error icon
@Component({
	selector: 'error-snackbar',
	template: '<span style="color:red">Error: </span>{{ data }}'
})
export class ErrorSnackBar {
	constructor(@Inject(MAT_SNACK_BAR_DATA) public data: any) { }
}

@Injectable({ providedIn: MaterialModule })
export class SnackService {
	private ref?: MatSnackBarRef<SimpleSnackBar | InfoSnackBar | WarnSnackBar | ErrorSnackBar>;
	private timeOut = 5000;

	constructor(public snack: MatSnackBar, private zone: NgZone) { }

	private setConfig(config: MatSnackBarConfig) {
		config.verticalPosition = config.verticalPosition || 'bottom';
		return { duration: this.timeOut, ...config };
	}

	public open(msg: string, action?: string, config: MatSnackBarConfig = {}) {
		this.dismiss();
		this.ref = this.snack.open(msg, action, this.setConfig(config));
	}

	public info(msg: string, action?: string, config: MatSnackBarConfig = {}) {
		this.fromComponent<InfoSnackBar>(InfoSnackBar, config, msg);
	}

	public warn(msg: string, action?: string, config: MatSnackBarConfig = {}) {
		this.fromComponent<WarnSnackBar>(WarnSnackBar, config, msg);
	}

	public error(msg: string, config: MatSnackBarConfig = {}) {
		lprintf(getCaller(), msg);
		this.fromComponent<ErrorSnackBar>(ErrorSnackBar, config, msg);
		throw new Error(msg);
	}

	public dismiss() {                    // dismiss any snackbar, if present
		if (this.ref)
			this.ref = undefined;
	}

	// TODO: fix 'any' typing for component
	private fromComponent<T extends InfoSnackBar | WarnSnackBar | ErrorSnackBar>(component: any, config: MatSnackBarConfig = {}, msg: string) {
		this.dismiss();
		this.zone.run(_ => {
			this.ref = this.snack.openFromComponent<T>(component, { ...this.setConfig(config), data: msg })
		});
	}
}
