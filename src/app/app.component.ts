import { Component } from '@angular/core';
import { FireService } from '@dbase/fire/fire.service';

@Component({
  selector: 'wb-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {

  constructor(private readonly fire: FireService) { }

}
