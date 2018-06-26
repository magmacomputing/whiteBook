import { Component } from '@angular/core';
import { DataService } from '@dbase/data/data.service';

@Component({
  selector: 'wb-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {

  constructor(private readonly data: DataService) { }

}
