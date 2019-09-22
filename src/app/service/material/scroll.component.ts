import { Component, OnInit, OnDestroy, EventEmitter, ElementRef, Input, Output, ViewChild } from '@angular/core';

@Component({
	selector: 'wb-scroll',
	templateUrl: `<ng-content></ng-content><div #anchor></div>`,
})
export class ScrollComponent implements OnInit, OnDestroy {
	@Input() options = {};
	@Output() scrolled = new EventEmitter();
	@ViewChild('anchor', { static: false }) anchor!: ElementRef<HTMLElement>;

	private observer!: IntersectionObserver;

	constructor(private host: ElementRef) { }

	ngOnInit() { }

	ngOnDestroy() { }

	get element() {
		return this.host.nativeElement;
	}
}
