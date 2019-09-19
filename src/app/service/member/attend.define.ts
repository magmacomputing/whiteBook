import { REACT } from '@dbase/data/data.define';
import { TString } from '@lib/type.library';

export const ATTEND = {
	maxColumn: 100,										// maximum Attends per Payment
	autoApprove: 'whiteBook',
}

export enum PAY {										// Test if a Payment can accept an Attend
	'under_limit',										// less than ATTEND.maxColumn Attends against a Payment
	'enough_funds',										// price of class is less-than-or-equal available Payment funds
	'not_expired',										// date of class does not exceed Payment expiry
}

export interface PForum {
	comment?: TString;								// optional Comment to add to an Attend
	react?: REACT;										// optional React to add to an Attend
}