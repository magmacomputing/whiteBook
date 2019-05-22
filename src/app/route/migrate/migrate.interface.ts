import { TString } from "@lib/type.library";

export interface MRegister {
	id: string;
	provider: 'fb' | 'g+' | 'gh' | 'li' | 'tw';
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
}