import { Component } from '@angular/core';
import { FireService } from '@app/dbase/fire/fire.service';

@Component({
  selector: 'wb-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {

  constructor(private fire: FireService) { }

}
