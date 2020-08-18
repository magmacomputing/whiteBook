import { CLASS } from '@dbase/data/data.define';

export namespace Migrate {
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
		priorStep: CLASS.MultiStep,
		priorSmartStep: CLASS.SmartStep,
		priorStepDown: CLASS.StepDown,
		priorAeroStep: CLASS.AeroStep,
		priorHiLo: CLASS.HiLo,
		priorZumba: CLASS.Zumba,
		priorZumbaStep: CLASS.ZumbaStep,
	}

	export const SPECIAL = ['oldEvent', 'Spooky', 'Event', 'Zombie', 'Special', 'Xmas', 'Creepy', 'Holiday', 'Routine', 'Fiesta'];
	export const PACK = ['oldSunday3Pak', 'oldSunday3For2', 'Sunday3For2'];

	export enum CREDIT {
		'value',
		'zero',
		'all',
	}

	export const SHEET_URL = 'https://script.google.com/a/macros/magmacomputing.com.au/s/AKfycby0mZ1McmmJ2bboz7VTauzZTTw-AiFeJxpLg94mJ4RcSY1nI5AP/exec';
	export const SHEET_PREFIX = 'alert';

	export const Instructor = 'JorgeEC';
}