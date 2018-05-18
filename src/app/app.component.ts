import { Component, OnInit } from '@angular/core';
import { FireService } from '@app/dbase/fire/fire.service';

@Component({
  selector: 'wb-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {

  constructor(private fire: FireService) { }

  ngOnInit() {
    // this.fire.sync('client')
    // .subscribe()
  }
}
