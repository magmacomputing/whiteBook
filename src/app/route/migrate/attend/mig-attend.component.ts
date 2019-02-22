import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { dbg } from '@lib/logger.library';

@Component({
  selector: 'wb-mig-attend',
  templateUrl: './mig-attend.component.html',
})
export class MigAttendComponent implements OnInit {
  private dbg = dbg(this);
  private url = 'https://script.google.com/a/macros/magmacomputing.com.au/s/AKfycby0mZ1McmmJ2bboz7VTauzZTTw-AiFeJxpLg94mJ4RcSY1nI5AP/exec';

  constructor(private http: HttpClient) {
    const query = 'action=history&prefix=alert&provider=fb&id=1062299231';

    this.dbg('fetching...');
    this.http.get(`${this.url}?${query}`, { responseType: 'text' })
      .subscribe(res => {
        const json = res.substring(0, res.length - 1).substring(6, res.length);
        try {
          const obj = JSON.parse(json);
          const hist = obj.history!.history || [];
          this.dbg('get: %j',hist.length);
          this.dbg('get: %j', hist[hist.length - 1]);
          this.dbg('get: %j', hist);
        } catch (err) {
          this.dbg('not a valid JSON');
        }
      })
  }

  ngOnInit() { }
}
