import { Component, OnInit } from '@angular/core';
import { MemberService } from '@dbase/app/member.service';

@Component({
  selector: 'wb-account',
  templateUrl: './account.component.html',
  styleUrls: ['./account.component.css']
})
export class AccountComponent implements OnInit {

  constructor(readonly member: MemberService) { }

  ngOnInit() { }

}
