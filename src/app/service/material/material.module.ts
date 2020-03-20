import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DragDropModule } from '@angular/cdk/drag-drop';

import { MATERIAL_SANITY_CHECKS, MatRippleModule } from '@angular/material/core';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatMenuModule } from '@angular/material/menu';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatDividerModule } from '@angular/material/divider';
import { MatTabsModule } from '@angular/material/tabs';
import { MatBadgeModule } from '@angular/material/badge';
import { MatSnackBarModule, MAT_SNACK_BAR_DEFAULT_OPTIONS } from '@angular/material/snack-bar';

import { InfoDialogComponent } from '@service/material/dialog.service';

const modules = [
	MatToolbarModule,
	MatDialogModule,
	MatMenuModule,
	MatButtonModule,
	MatIconModule,
	MatCheckboxModule,
	MatCardModule,
	MatDatepickerModule,
	MatExpansionModule,
	MatDividerModule,
	MatSnackBarModule,
	MatTabsModule,
	MatBadgeModule,
	MatRippleModule,
]

@NgModule({
	imports: [
		CommonModule,
		DragDropModule,
		...modules,
	],
	exports: [
		DragDropModule,
		...modules
	],
	providers: [
		{ provide: MATERIAL_SANITY_CHECKS, useValue: false },
		{ provide: MAT_SNACK_BAR_DEFAULT_OPTIONS, useValue: { duration: 5000 } },
	],
	declarations: [InfoDialogComponent],
})
export class MaterialModule { }