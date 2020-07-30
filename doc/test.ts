function triggerMember(e) {
	var sheet = e.source.getActiveSheet();
	var range = e.source.getActiveRange();
	var cell = e.source.getActiveCell();
	var val = cell.getValue().toString().trim();
	var firstChar = val.substring(0, 1);
	Logger.log('val: ' + typeof val);

	var freeTracking = MEMBER_AREA.sumHeadVal.indexOf('freeTracking');
	var sumDetail = sheet.getRange(MEMBER_AREA.sumRange);
	var freeCell = sumDetail.offset(0, freeTracking, 1, 1);
	if ((cell.getA1Notation() == freeCell.getA1Notation()) && (freeTracking != -1)) {       // onEdit free Tracking summary cell
		Logger.log(sheet.getName() + ': change to Free Tracking');
		var cellVal;
		var valArray = val.split('.');

		for (var i = 0; i < valArray.length; i++) {
			valArray[i] = parseInt(valArray[i]);                    // ensure all cells are in expected format
			if (isNaN(valArray[i])) {
				range.setValue('');                                   // else reset the user-input value
				return;
			}
		}

		if (valArray[2] == undefined || valArray[3] != undefined)
			cellVal = '';
		if (valArray[1] == undefined)
			cellVal = moment().format(DATE_FMT.yearMonthDay) + '.' + val + '.0';

		if (cellVal != undefined) {
			Logger.log('free: ' + cellVal);
			range.setValue(cellVal);
		}
		return;
	}

	if (firstChar == '>' || firstChar == '<') {       // record a new Payment
		range.setValue('');
		var amt = val.substring(1).trim();
		if (amt == '')
			amt = undefined;
		else if (firstChar == '<')
			amt = -amt;
		addRowService(amt);
		return;
	}

	if (firstChar == '$') {                           // recalculate the Member summary-line
		range.setValue('');
		editCredit();
		//  editBonus();
		return;
	}

	if (val.substring(0, 2) == '0.')                   // if you type '.3', GAS turns this into '0.3' before onEdit fired
		val = '.' + val.substring(2);                   // so, adjust numeric back to string

	var onHold = MEMBER_AREA.dataHeadVal.indexOf('hold') + 1;
	var amount = MEMBER_AREA.dataHeadVal.indexOf('amount') + 1;
	var approved = MEMBER_AREA.dataHeadVal.indexOf('approved') + 1;
	var col = range.getColumn();
	var row = range.getRow();

	// if you are changing the Hold, Amount, or Approved column, then recalc creditExpiry
	if (row >= MEMBER_AREA.row && (col == onHold || col == amount || col == approved) && firstChar != '.') {
		editCredit();
		editExpiry();
		return;
	}

	if (firstChar != '.') {
		editCredit();
		return;
	}

	if (val == '.') {                                 // this is meant for 'Approved' cells
		setDate();
		editExpiry();
		return;
	}

	var type = val.substring(1).toLowerCase();
	var event;
	switch (type) {
		//    case 's': event = 'Step'; break;       // 2019-Dec-04
		case 'm': event = 'Step'; break;
		case 'h': event = 'HiLo'; break;
		case 'd': event = 'StepDown'; break;
		case 'a': event = 'AeroStep'; break;
		case 'z': event = 'Zumba'; break;
		//    case 't': event = 'SmartStep'; break;  // 2019-Dec-04
		case 's': event = 'SmartStep'; break;
		case 'i': event = 'StepIn'; break;
		case 'zs': event = 'ZumbaStep'; break;
		case '3':
		case 'sun': event = 'Sunday3For2'; break;
		//  case 'ev1': event = 'Event*1'; break;
		//  case 'ev2': event = 'Event*2'; break;
		//  case 'ev3': event = 'Event*3'; break;
		//  case 'ev4': event = 'Event*4'; break;
		//  case '': break;
		case undefined:
		case null: event = 'Step'; break;
		default:
			Logger.log('Not a valid Type.  Must be m / h / d / a / s / i / z / zs / sun');
			return;
	}

	range.setValue('');                             // get rid of the dot-command, so the cell is reset
	addCellEvent(event);                            // get the ContentService to add the Event
	return;
}