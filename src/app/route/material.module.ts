import { NgModule } from '@angular/core';

import { MATERIAL_SANITY_CHECKS } from '@angular/material';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatMenuModule } from '@angular/material/menu';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';

const modules = [
	MatToolbarModule,
	MatMenuModule,
	MatButtonModule,
	MatIconModule,
	MatCheckboxModule,
	MatCardModule,
	MatDatepickerModule,
	MatNativeDateModule,
	MatExpansionModule,
	MatDividerModule,
	MatSnackBarModule,
	MatTabsModule,
]

@NgModule({
	imports: [...modules],
	exports: [...modules],
	providers: [{ provide: MATERIAL_SANITY_CHECKS, useValue: false }],
})
export class MaterialModule { }