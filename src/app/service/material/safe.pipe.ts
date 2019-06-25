import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml, SafeStyle, SafeScript, SafeUrl, SafeResourceUrl } from '@angular/platform-browser';

@Pipe({ name: 'safe' })
export class SafePipe implements PipeTransform {

  constructor(protected sanitize: DomSanitizer) { }

  transform(value: any, type?: string): SafeHtml | SafeStyle | SafeScript | SafeUrl | SafeResourceUrl {
    switch (type) {
      case 'html': return this.sanitize.bypassSecurityTrustHtml(value);
      case 'style': return this.sanitize.bypassSecurityTrustStyle(`linear-gradient(rgba(29, 29, 29, 0), rgba(16, 16, 23, 0.5)), url(${value})`);
      case 'script': return this.sanitize.bypassSecurityTrustScript(value);
      case 'url': return this.sanitize.bypassSecurityTrustUrl(value);
      case 'resourceUrl': return this.sanitize.bypassSecurityTrustResourceUrl(value);
      default: throw new Error(`Invalid safe type specified: ${type}`);
    }
  }
}
