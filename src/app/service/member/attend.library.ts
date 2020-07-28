import { ITimetableState } from '@dbase/state/state.define';
import { FIELD, BONUS, COLLECTION, STORE } from '@dbase/data/data.define';
import { IGift, TBonus, IAttend, ISchedule } from '@dbase/data/data.schema';

import { TDate, getDate, Instant } from '@library/instant.library';
import { TString, isUndefined } from '@library/type.library';
import { asArray } from '@library/array.library';
import { plural } from '@library/string.library';

/**
 * Determine if provided event is entitled to a Gift or a Bonus  
 * source:	info about the effective Plans, Bonus, etc. and current Member
 * event:	  a Class name
 * date:		effective date, else today
 * elect:		Bonus override (e.g. Member may elect to *not* use one of their Gifts)
 */
export const calcBonus = (source: ITimetableState, event: string, date?: TDate, elect?: BONUS) => {
	const now = getDate(date);
	const today = now.format(Instant.FORMAT.yearMonthDay);
	const upd: IGift[] = [];																// an array of updates for caller to apply on /member/gift
	let bonus = {} as TBonus;																// calculated Bonus entitlement

	const gifts = source[COLLECTION.member][STORE.gift];								// the active Gifts for this Member
	const plan = (source[COLLECTION.client][STORE.plan] || [])[0];			// Member's current plan
	const { attendGift = [], attendWeek = [], attendMonth = [], attendToday = [] } = source[COLLECTION.attend];
	const scheme = (source[COLLECTION.client][STORE.bonus] || [])
		.groupBy<BONUS>(FIELD.key);														// get the <rules> for each Bonus

	// TODO: I am of the opinion that <gift> should be tested *after* other bonus-types.  
	switch (true) {
		/**
		 * Admin adds 'Gift' records to a Member's account which will detail the start-date
		 * and limit of free classes (and an optional expiry-date for the Gift).  
		 * These gifts will be used in preference to any other Bonus scheme.
		 * 
		 * Even though the Member may have an active Gift, we check if any of them are useable.  
		 * If not, we pass back an array of auto-expire updates for the caller to apply.
		 * 
		 * If ok to use, we pass back an array of count-tracking updates for the caller to apply.
		 */
		case gifts.length > 0																	// if Member has some open Gifts
			&& (isUndefined(elect) || elect === BONUS.gift):		//   and has not elected to *skip* this Bonus

			let curr = -1;																			// the Gift to use in determining eligibility
			gifts.forEach((gift, idx) => {
				gift.count = attendGift														// attendGift might relate to multiple-Gifts
					.filter(attd => attd.bonus![FIELD.id] === gift[FIELD.id])
					.length + 1;																		// count the Attends per active Gift, plus one for this Gift

				const giftLeft = gift.limit - gift.count;					// how many remain
				if (giftLeft < 0																	// max number of Attends against this gift reached
					|| (gift.expiry || 0) > now.ts)									// 	or this Gift expiry has passed
					upd.push({ [FIELD.expire]: now.ts, ...gift })		// auto-expire it
				else if (curr === -1) {														// found the first useable Gift
					curr = idx;
					upd.push({																			// stack the Gift update
						[FIELD.effect]: now.startOf('day').ts,
						[FIELD.expire]: giftLeft <= 0 ? now.ts : undefined,
						...gift,
					})
					bonus = {																				// create a Bonus object
						[FIELD.id]: gift[FIELD.id],
						[FIELD.type]: BONUS.gift,
						count: gift.count,
						desc: `${giftLeft} ${plural(giftLeft, 'gift')}`,
					}
				}
			});

			if (curr > -1)																			// processed a Gift
				break;																						// exit switch-case

		case !plan.bonus:																			// Member's Plan does not allow Bonus
			break;																							//	so no further checking needed

		/**
		 * The Week scheme qualifies as a Bonus if the Member attends the required number of non-bonus days in a week (scheme.week.level).  
		 * (note: even 'Gift Attends' count towards a Bonus)
		 * The Member must also have claimed less than the free limit (scheme.week.free) to enable this bonus
		 */
		case scheme.week
			&& attendWeek																				// sum the non-Bonus -or- Gift Attends
				.filter(row => isUndefined(row.bonus) || row.bonus[FIELD.type] === BONUS.gift)
				.filter(row => row.track[FIELD.date] !== today)		// dont count today's attend
				.distinct(row => row.track[FIELD.date])						// de-dup by day-of-week
				.length >= scheme.week.level											// must attend the 'level' number
			&& attendWeek																				// sum the 'week' bonus claimed
				.filter(row => row.bonus?.[FIELD.type] === BONUS.week)
				.length < scheme.week.free												// must attend less than 'free' number
			&& (isUndefined(elect) || elect === BONUS.week):		// if not skipped, then Bonus will apply

			bonus = {
				[FIELD.id]: scheme.week[FIELD.id],
				[FIELD.type]: BONUS.week,
				count: attendWeek.filter(row => row.bonus?.[FIELD.type] === BONUS.week).length + 1,
				desc: scheme.week.desc,
			}
			break;

		/**
		 * The Class scheme qualifies as a Bonus if the Member attends the required number of non-bonus classes in a week (scheme.class.level).  
		 * (note: 'Gift' attends do not count towards a Bonus)
		 * THe Member must also have claimed less than the free limit (scheme.class.free) to enable this bonus
		 */
		case scheme.class
			&& attendWeek
				.filter(row => isUndefined(row.bonus) || row.bonus[FIELD.type] === BONUS.gift)	// only non-Bonus attends
				.length >= scheme.class.level											// must attend the 'level' number
			&& attendWeek																				// sum the 'week' bonus claimed
				.filter(row => row.bonus?.[FIELD.type] === BONUS.class)
				.length < scheme.class.free												// must attend less than 'free' number
			&& (isUndefined(elect) || elect === BONUS.class):		// if not skipped, then Bonus will apply

			bonus = {
				[FIELD.id]: scheme.class[FIELD.id],
				[FIELD.type]: BONUS.class,
				count: attendWeek.filter(row => row.bonus?.[FIELD.type] === BONUS.class).length + 1,
				desc: scheme.class.desc,
			}
			break;


		/**
		 * The Sunday scheme qualifies as a Bonus if the Member attends the required number of non-bonus classes in a week (scheme.sunday.level).  
		 * Note: the Week scheme takes precendence (if qualifies on Sunday, and not claimed on Saturday)
		 * The class must be in the free list (scheme.week.free) to qualify for this bonus
		 */
		case scheme.sunday
			&& attendWeek																				// count Attends this week either Gift or non-Bonus
				.filter(row => isUndefined(row.bonus) || row.bonus[FIELD.type] === BONUS.gift)
				.filter(row => row.track[FIELD.date] !== today)		// dont count today's attend
				.distinct(row => row.track[FIELD.date])						// de-dup by day-of-week
				.length >= scheme.sunday.level										// required number of Attends this week
			&& now.dow === Instant.WEEKDAY.Sun									// today is 'Sunday'
			&& elect == BONUS.sunday														// Member elected to take Bonus
			&& asArray(scheme.sunday.free as TString).includes(event):

			bonus = {
				[FIELD.id]: scheme.sunday[FIELD.id],
				[FIELD.type]: BONUS.sunday,
				count: attendWeek.filter(row => row.bonus?.[FIELD.type] === BONUS.sunday).length + 1,
				desc: scheme.sunday.desc,
			}
			break;

		/**
		 * The Month scheme qualifies as a Bonus if the Member attends the required number of full-price classes in a month (scheme.month.level).  
		 * The Member must also have attended less than the free limit (scheme.month.free) to qualify for this bonus
		 */
		case scheme.month
			&& attendMonth
				.filter(row => isUndefined(row.bonus) || row.bonus[FIELD.type] === BONUS.gift)
				.filter(row => row.track[FIELD.date] !== today)		// dont count today's attend
				.distinct(row => row.track[FIELD.date])
				.length >= scheme.month.level
			&& attendMonth
				.filter(row => row.bonus?.[FIELD.type] === BONUS.month)
				.length < scheme.month.free
			&& (isUndefined(elect) || elect === BONUS.month):

			bonus = {
				[FIELD.id]: scheme.month[FIELD.id],
				[FIELD.type]: BONUS.month,
				count: attendMonth.filter(row => row.bonus?.[FIELD.type] === BONUS.month).length + 1,
				desc: scheme.month.desc,
			}
			break;

		/**
		 * The Home scheme qualifies as a Bonus if the Member has already attended an '@Home' class earlier today
		 */
		case scheme.home
			&& attendToday
				.map(attend => attend.timetable[FIELD.id])				// get ID of the schedule attended
				.map(id => source.client.schedule?.find(sched => sched[FIELD.id] === id) as ISchedule)
				.filter(sched => sched && sched.location === BONUS.home)
				.length >= scheme.home.level											// required number of Attends today
			&& (isUndefined(elect) || elect !== BONUS.none):		// Member elected to not take Bonus

			bonus = {
				[FIELD.id]: scheme.home[FIELD.id],
				[FIELD.type]: BONUS.home,
				count: attendToday.length + 1,
				desc: scheme.home.desc,
			}
			break;
	}

	if (upd.length)																					// whether or not we found an applicable Bonus
		bonus.gift = upd;																			// let caller know about any pending Gift updates

	return bonus;
}