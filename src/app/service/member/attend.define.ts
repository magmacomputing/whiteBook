export const ATTEND = {
	maxColumn: 100,										// maximum Attends per Payment
	autoApprove: 'whiteBook',
	maxPayment: 10,										// maximum number of attempts to match an Attend to a Payment
}

export enum PAY {										// Test if a Payment can accept an Attend
	'under_limit',										// less than ATTEND.maxColumn Attends against a Payment
	'enough_funds',										// price of class is less-than-or-equal available Payment funds
	'not_expired',										// date of class does not exceed Payment expiry
}