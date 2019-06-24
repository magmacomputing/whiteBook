import { ITimetableState } from '@dbase/state/state.define';
import { FIELD, BONUS } from '@dbase/data/data.define';
import { IGift, TBonus, IBonus } from '@dbase/data/data.schema';

import { TDate, getDate, Instant } from '@lib/date.library';
import { IObject } from '@lib/object.library';
import { asArray } from '@lib/array.library';
import { TString, isUndefined } from '@lib/type.library';

/**
 * Determine if provided event is entitled to a Gift or a Bonus Scheme
 */
export const calcBonus = (source: ITimetableState, event: string, date?: TDate) => {
	const now = getDate(date);
	let bonus = {} as TBonus;
	const upd: IGift[] = [];																// an array of updates to Gifts
	const elect: BONUS | undefined = undefined;							// TODO: migration can specify 'bonus-elect'

	const gifts = source.member.gift;												// the active Gifts for this Member
	const plans = source.client.plan || [];
	const { attendGift = [], attendWeek = [], attendMonth = [] } = source.attend;
	const scheme = (source.client.bonus || []).reduce((acc, row) => {
		acc[row[FIELD.key]] = row;
		return acc;
	}, {} as IObject<IBonus>);

	if (!plans[0].bonus)
		return bonus;																					// Plan does not allow for Gift / Bonus

	switch (true) {
		/**
		 * Admin adds 'Gift' records to a Member's account which will detail
		 * the start-date, and count of free classes (and an optional expiry for the Gift).  
		 * This gift will be used in preference to any other bonus-pricing scheme.
		 */
		case gifts.length > 0																// if Member has some open Gifts
			&& (isUndefined(elect) || elect === BONUS.gift):		//   and has not elected to *skip* this Bonus

			const counts = gifts.map(gift => attendGift.filter(attd => attd.bonus![FIELD.id] === gift[FIELD.id]).length);
			let curr = -1;																			// the Gift to use in determining eligibility

			gifts.forEach((gift, idx) => {
				if (counts[idx] >= gifts[idx].count								// max number of Attends against this gift
					|| (gifts[idx].expiry || 0) > now.ts)						// 	or this Gift expiry has passed
					upd.push({ [FIELD.expire]: now.ts, ...gift })		// auto-expire it
				else if (curr === -1) curr = idx;									// else found a Gift that might apply
			})

			if (curr > -1) {
				const attendCnt = counts[curr];										// how many Attends already against this Gift
				const gift = gifts[curr];
				bonus = {
					[FIELD.id]: gift[FIELD.id],											// Bonus id is the Gift Id
					[FIELD.type]: BONUS.gift,												// Bonus type is 'gift'
					count: attendCnt + 1,														// to help with tracking
					desc: `${gift.count - attendCnt} gifts left`,
					gift: [...upd, {
						[FIELD.effect]: gift[FIELD.effect] || now.startOf('day').ts,
						[FIELD.expire]: gift.count - attendCnt <= 1 ? now.ts : undefined,
						...gift,
					}],
				}
				break;																						// exit switch-case
			}

		/**
		 * The Week scheme qualifies as a Bonus if the Member attends the required number of non-bonus classes in a week (scheme.week.level).  
		 * (note: even Gift Attends count towards a Bonus)
		 * The Member must also have claimed less than the free limit (scheme.week.free) to enable this bonus
		 */
		case scheme.week
			&& attendWeek																				// sum the non-Bonus -or- Gift Attends
				.filter(row => isUndefined(row.bonus) || row.bonus[FIELD.type] === BONUS.gift)
				.distinct(row => row.track[FIELD.date])						// de-dup by day-of-week
				.length >= scheme.week.level											// must attend the 'level' number
			&& attendWeek																				// sum the 'week' bonus claimed
				.filter(row => row.bonus && row.bonus[FIELD.type] === BONUS.week)
				.length < scheme.week.free												// must attend less than 'free' number
			&& (isUndefined(elect) || elect === BONUS.week):		// if not skipped, then Bonus will apply

			bonus = {
				[FIELD.id]: scheme.week[FIELD.id],
				[FIELD.type]: BONUS.week,
				count: attendWeek.filter(row => row.bonus && row.bonus[FIELD.type] === BONUS.week).length + 1,
				desc: scheme.week.desc,
				gift: upd,
			}
			break;

		/**
		 * The Sunday scheme qualifies as a Bonus if the Member attends the required number of non-bonus classes in a week (scheme.sunday.level),
		 * and did not qualify for the Week scheme previously (e.g. already claimed yesterday?).    
		 * The class must be in the free list (scheme.week.free) to qualify for this bonus
		 */
		case scheme.sunday
			&& attendWeek																				// count Attends this week either Gift or non-Bonus
				.filter(row => isUndefined(row.bonus) || row.bonus[FIELD.type] === BONUS.gift)
				.distinct(row => row.track[FIELD.date])						// de-dup by day-of-week
				.length >= scheme.sunday.level										// required number of Attends this week
			&& now.dow === Instant.DAY.Sun											// today is 'Sunday'
			&& elect == BONUS.sunday														// Member elected to take Bonus
			&& (asArray(scheme.sunday.free as TString)).includes(event):

			bonus = {
				[FIELD.id]: scheme.sunday[FIELD.id],
				[FIELD.type]: BONUS.sunday,
				count: attendWeek.filter(row => row.bonus && row.bonus[FIELD.type] === BONUS.sunday).length + 1,
				desc: scheme.sunday.desc,
				gift: upd,
			}
			break;

		/**
	 * The Month scheme qualifies as a Bonus if the Member attends the required number of full-price classes in a month (scheme.month.level).  
	 * The Member must also have attended less than the free limit (scheme.month.free) to qualify for this bonus
	 */
		case scheme.month
			&& attendMonth
				.filter(row => isUndefined(row.bonus) || row.bonus[FIELD.type] === BONUS.gift)
				.distinct(row => row.track[FIELD.date])
				.length >= scheme.month.level
			&& attendMonth
				.filter(row => row.bonus && row.bonus[FIELD.type] === BONUS.month)
				.length < scheme.month.free
			&& (isUndefined(elect) || elect === BONUS.month):

			bonus = {
				[FIELD.id]: scheme.month[FIELD.id],
				[FIELD.type]: BONUS.month,
				count: attendMonth.filter(row => row.bonus && row.bonus[FIELD.type] === BONUS.month).length + 1,
				desc: scheme.month.desc,
				gift: upd,
			}
			break;
	}

	return bonus;
}