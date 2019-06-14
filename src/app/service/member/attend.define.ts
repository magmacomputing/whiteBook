export const MEMBER = {
	maxColumn: 100,										// maximum Attends per Payment
	autoApprove: 'whiteBook',
}

export enum PAY {										// Test if a Payment can accept an Attend
	'under_limit',										// less than MEMBER.maxColumn Attends in a Payment
	'enough_funds',										// price of class is less-than-or-equal Payment funds
	'not_expired',										// date of class does not exceed Payment expiry
}