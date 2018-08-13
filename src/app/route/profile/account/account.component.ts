import { Component, OnInit } from '@angular/core';
import { DataService } from '@dbase/data/data.service';
import { MemberService } from '@dbase/app/member.service';

@Component({
  selector: 'wb-account',
  templateUrl: './account.component.html',
  styleUrls: ['./account.component.css']
})
export class AccountComponent implements OnInit {

  constructor(private readonly data: DataService, private readonly member: MemberService) { }

  ngOnInit() { }

}
