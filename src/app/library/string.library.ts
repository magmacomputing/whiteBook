/**
 * General <string> functions
 */

export const toProperCase = (...str: string[]): string =>
  str
    .map(text => text.replace(/\w\S*/g,
      word => word.charAt(0).toUpperCase() + word.substr(1).toLowerCase()))
    .join(' ');

export const isNumeric = (str: any): str is number =>
  !isNaN(parseFloat(str)) && isFinite(str);

export const toNumeric = (str: string | number, stripZero: boolean = false) =>
  isNumeric(str) && (str.toString().substring(0, 1) !== '0' || stripZero)
    ? parseInt(str.toString(), 10)
    : str;
