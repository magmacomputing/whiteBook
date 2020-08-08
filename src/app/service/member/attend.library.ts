import { ITimetableState } from '@dbase/state/state.define';
import { FIELD, BONUS, COLLECTION, STORE } from '@dbase/data/data.define';
import type { IGift, TBonus, ISchedule, IAttend, IBonus } from '@dbase/data/data.schema';

import { TDate, getDate, Instant } from '@library/instant.library';
import { TString, isUndefined, isEmpty } from '@library/type.library';
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
	const upd: IGift[] = [];																// an array of updates for caller to apply on /member/gift
	let bonus = {} as TBonus;																// calculated Bonus entitlement

	const gifts = source[COLLECTION.member][STORE.gift];								// the active Gifts for this Member
	const plan = (source[COLLECTION.client][STORE.plan] || [])[0];			// Member's current plan
	const { attendGift = [], attendWeek = [], attendMonth = [], attendToday = [] } = source[COLLECTION.attend];

	(source[COLLECTION.client][STORE.bonus] || [])					// current Bonus schemes
		.orderBy(FIELD.sort, FIELD.effect)										// order by Bonus.sort, Bonus._effect
		.forEach(scheme => {																	// loop over each Bonus by sort-order
			if (!isEmpty(bonus))
				return;																						// already found a Bonus

			switch (scheme[FIELD.key]) {
				case BONUS.gift:
					if (gifts.length > 0 && (isUndefined(elect) || elect === BONUS.gift))
						bonusGift(bonus, upd, attendGift, now, gifts);
					if (upd.length)																	// whether or not we found an applicable Bonus
						bonus.gift = upd;															// let caller know about any pending Gift updates
					break;

				case BONUS.none:																	// not entitled to attend-related Bonus
					break;

				case BONUS.week:
					bonusWeek(bonus, scheme, attendWeek, now, elect);
					break;

				case BONUS.class:
					bonusClass(bonus, scheme, attendWeek, now, elect);
					break;

				case BONUS.sunday:
					bonusSunday(bonus, scheme, attendWeek, now, elect, event);
					break;

				case BONUS.month:
					bonusMonth(bonus, scheme, attendMonth, now, elect);
					break;

				case BONUS.home:
					bonusHome(bonus, scheme, attendToday, now, elect, event);
					break;
			}
		})

	return bonus;
}

/**
 * Admin adds 'Gift' records to a Member's account which will detail the start-date
 * and limit of free classes (and an optional expiry-date for the Gift).  
 * 
 * Even though the Member may have an active Gift, we check if any of them are useable.  
 * If not, we pass back an array of auto-expire updates for the caller to apply.
 * 
 * If ok to use, we pass back an array of count-tracking updates for the caller to apply.
 */
const bonusGift = (bonus: TBonus, upd: IGift[], attendGift: IAttend[], now: Instant, gifts: IGift[]) => {
	let curr = -1;																			// the Gift to use in determining eligibility
	gifts.forEach((gift, idx) => {
		gift.count = attendGift														// attendGift might relate to multiple-Gifts
			.filter(attd => attd.bonus?.[FIELD.id] === gift[FIELD.id])
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
	})
}
/**
 * The Week scheme qualifies as a Bonus if the Member attends the required number of non-bonus days in a week (scheme.level).  
 * (note: even 'Gift Attends' count towards a Bonus)
 * The Member must also have claimed less than the free limit (scheme.free) to enable this bonus
 */
const bonusWeek = (bonus: TBonus, scheme: IBonus, attendWeek: IAttend[], now: Instant, elect: BONUS | undefined) => {
	const today = now.format(Instant.FORMAT.yearMonthDay);
	const okLevel = attendWeek																	// sum the non-Bonus -or- Gift Attends
		.filter(row => isUndefined(row.bonus) || row.bonus[FIELD.type] === BONUS.gift)
		.filter(row => row.track[FIELD.date] !== today)						// dont count today's attend
		.distinct(row => row.track[FIELD.date])										// de-dup by day-of-week
		.length >= scheme.level																		// must attend the 'level' number
	const okFree = attendWeek																		// sum the bonus claimed
		.filter(row => row.bonus?.[FIELD.type] === BONUS.week)
		.length < scheme.free																			// must attend less than 'free' number
	const okElect = (isUndefined(elect) || elect === BONUS.week)// if not skipped, then Bonus will apply

	if (okLevel && okFree && okElect)
		bonus = {
			[FIELD.id]: scheme[FIELD.id],
			[FIELD.type]: BONUS.week,
			count: attendWeek.filter(row => row.bonus?.[FIELD.type] === BONUS.week).length + 1,
			desc: scheme.desc,
		}

	return;
}

/**
 * The Class scheme qualifies as a Bonus if the Member attends the required number of non-bonus classes in a week (scheme.level).  
 * (note: 'Gift' attends do not count towards a Bonus)
 * THe Member must also have claimed less than the free limit (scheme.free) to enable this bonus
 */
const bonusClass = (bonus: TBonus, scheme: IBonus, attendWeek: IAttend[], now: Instant, elect: BONUS | undefined) => {
	const okLevel = attendWeek																	// sum the non-Bonus -or- Gift Attends
		.filter(row => isUndefined(row.bonus) || row.bonus[FIELD.type] === BONUS.gift)
		.length >= scheme.level																		// must attend the 'level' number
	const okFree = attendWeek																		// sum the bonus claimed
		.filter(row => row.bonus?.[FIELD.type] === BONUS.class)
		.length < scheme.free																			// must attend less than 'free' number
	const okElect = (isUndefined(elect) || elect === BONUS.class);// if not skipped, then Bonus will apply

	if (okLevel && okFree && okElect) {
		bonus = {
			[FIELD.id]: scheme[FIELD.id],
			[FIELD.type]: BONUS.class,
			count: attendWeek.filter(row => row.bonus?.[FIELD.type] === BONUS.class).length + 1,
			desc: scheme.desc,
		}
	}

	return;
}

/**
 * The Sunday scheme qualifies as a Bonus if the Member attends the required number of non-bonus classes in a week (scheme.sunday.level).  
 * Note: the Week scheme takes precendence (if qualifies on Sunday, and not claimed on Saturday)
 * The class must be in the free list (scheme.week.free) to qualify for this bonus
 */
const bonusSunday = (bonus: TBonus, scheme: IBonus, attendWeek: IAttend[], now: Instant, elect: BONUS | undefined, event: string) => {
	const today = now.format(Instant.FORMAT.yearMonthDay);
	const okLevel = attendWeek																	// count Attends this week either Gift or non-Bonus
		.filter(row => isUndefined(row.bonus) || row.bonus[FIELD.type] === BONUS.gift)
		.filter(row => row.track[FIELD.date] !== today)						// dont count today's attend
		.distinct(row => row.track[FIELD.date])										// de-dup by day-of-week
		.length >= scheme.level																		// required number of Attends this week
	const okFree = asArray(scheme.free as TString).includes(event);
	const okElect = elect === BONUS.sunday && now.dow === Instant.WEEKDAY.Sun;

	if (okLevel && okFree && okElect) {
		bonus = {
			[FIELD.id]: scheme[FIELD.id],
			[FIELD.type]: BONUS.sunday,
			count: attendWeek.filter(row => row.bonus?.[FIELD.type] === BONUS.sunday).length + 1,
			desc: scheme.desc,
		}
	}

	return;
}

/**
 * The Month scheme qualifies as a Bonus if the Member attends the required number of full-price classes in a month (scheme.month.level).  
 * The Member must also have attended less than the free limit (scheme.month.free) to qualify for this bonus
 */
const bonusMonth = (bonus: TBonus, scheme: IBonus, attendMonth: IAttend[], now: Instant, elect: BONUS | undefined) => {
	const today = now.format(Instant.FORMAT.yearMonthDay);
	const okLevel = attendMonth
		.filter(row => isUndefined(row.bonus) || row.bonus[FIELD.type] === BONUS.gift)
		.filter(row => row.track[FIELD.date] !== today)		// dont count today's attend
		.distinct(row => row.track[FIELD.date])
		.length >= scheme.level
	const okFree = attendMonth
		.filter(row => row.bonus?.[FIELD.type] === BONUS.month)
		.length < scheme.free
	const okElect = (isUndefined(elect) || elect === BONUS.month);

	if (okLevel && okFree && okElect) {
		bonus = {
			[FIELD.id]: scheme[FIELD.id],
			[FIELD.type]: BONUS.month,
			count: attendMonth.filter(row => row.bonus?.[FIELD.type] === BONUS.month).length + 1,
			desc: scheme.desc,
		}
	}

	return;
}

/**
 * The Home scheme qualifies as a Bonus if the Member has already attended an '@Home' class earlier today
 */
const bonusHome = (bonus: TBonus, scheme: IBonus, attendToday: IAttend[], now: Instant, elect: BONUS | undefined, event: string) => {
	const okLevel = attendToday
		.filter(attend => attend.timetable[FIELD.key] === event)
		.length >= scheme.level																				// required number of Attends today
	const okElect = (isUndefined(elect) || elect !== BONUS.none);		// Member elected to not take Bonus

	if (okLevel && okElect) {
		bonus = {
			[FIELD.id]: scheme[FIELD.id],
			[FIELD.type]: BONUS.home,
			count: attendToday.length + 1,
			desc: scheme.desc,
		}
	}

	return;
}