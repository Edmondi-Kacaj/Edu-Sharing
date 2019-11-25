import {Pipe, PipeTransform} from "@angular/core";
import {RestConstants} from '../rest/rest-constants';
import {TranslateService} from '@ngx-translate/core';
@Pipe({name: 'authorityName'})
export class AuthorityNamePipe implements PipeTransform {
  constructor(private translate:TranslateService){}
  transform(authority : any,args:string[]=null): string {
    if(!authority)
      return "invalid";
    if(authority.profile && authority.profile.displayName)
      return authority.profile.displayName;
    if(authority.profile)
      return authority.profile.firstName+" "+authority.profile.lastName;
    if(authority.authorityType==RestConstants.AUTHORITY_TYPE_EVERYONE){
      return this.translate.instant('GROUP_EVERYONE');
    }
    if(authority.authorityName)
      return authority.authorityName;
    if(authority.firstName || authority.lastName)
      return authority.firstName+" "+authority.lastName;
    return "invalid";
  }
}
