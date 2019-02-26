export interface MRegister {
	id: string;
	provider: 'fb' | 'g+' | 'gh' | 'li' | 'tw';
	sheetName: string;
	firstName?: string;
	lastName?: string;
	picture?: string;
	isHidden?: boolean;
	isAdmin?: boolean;
}

export interface MHistory {
	stamp: number;
	date: number;
	type: string;
	title: string;
	debit?: string;
	credit?: string;
	note?: string;
	bank?: number;
}