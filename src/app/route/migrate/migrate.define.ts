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

export const COMMENTS = [
	'Great',
	'Hello',
	'Happy',
	'Jorge',
	'love',
	'good',
	'relax',
	"I'm",
	'Something',
	'instructor',
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