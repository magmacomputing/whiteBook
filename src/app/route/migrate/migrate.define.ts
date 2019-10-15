import { CLASS } from '@dbase/data/data.define';

export const LOOKUP: Record<string, CLASS> = {
	oldStep: CLASS.MultiStep,
	Step: CLASS.MultiStep,
	oldStepDown: CLASS.StepDown,
	oldAeroStep: CLASS.AeroStep,
	oldHiLo: CLASS.HiLo,
	oldZumba: CLASS.Zumba,
	oldZumbaStep: CLASS.ZumbaStep,
	oldSmartStep: CLASS.SmartStep,
	prevStep: CLASS.MultiStep,
	prevSmartStep: CLASS.SmartStep,
	prevStepDown: CLASS.StepDown,
	prevAeroStep: CLASS.AeroStep,
	prevHiLo: CLASS.HiLo,
	prevZumba: CLASS.Zumba,
	prevZumbaStep: CLASS.ZumbaStep,
	prevStepIn: CLASS.StepIn,
}

export const SPECIAL = ['oldEvent', 'Spooky', 'Event', 'Zombie', 'Special', 'Xmas', 'Creepy', 'Holiday', 'Routine'];
export const PACK = ['oldSunday3Pak', 'oldSunday3For2', 'Sunday3For2'];

export const CLEAN = {
	gift1: /Gift #\d+,/,
	gift2: /, Gift #\d+/,
	gift3: /Gift #\d+/,
	and: /and #\d+/,
	week: /Bonus: Week Level reached/,
	week2: /Bonus: week level reached/,
	spaces: /  +/g,
	newline: /\n/g,
	newlines: /\n\s*\n/g,
	comma1: /^,/,
	comma2: /,$/,
	colon1: /^:/,
	colon2: /:$/,
}
export const COMMENTS = [
	'Great',
	'Hello',
	'Happy',
	'Jorge',
	'love',
	'good',
	'relax',
	"I'm",
	'I am',
	'Something',
	'Instructor',
	'routine',
	'Whateva',
	'holiday',
	'clever',
	'xxx',
	'...',
	' 2017',
	'Lucie',
	'!',
	'?',
]