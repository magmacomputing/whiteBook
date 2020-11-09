import type { BONUS, Auth } from '@dbase/data.define';
import type { Migration } from './migrate.define';

export interface MRegister {
	id: string;
	provider: Auth.PROVIDER;
	sheetName: string;
	email: string;
	firstName?: string;
	lastName?: string;
	picture?: string;
	isHidden?: boolean;
	isAdmin?: boolean;
	uid: string;
}

export interface MHistory {
	stamp: number;
	date: number;
	type: string;
	title: string;
	debit?: string;
	credit?: string;
	note?: string;
	hold?: number;
	funds?: number;
	approved?: number;
	elect?: BONUS;
}