import {Component, Input, Output, EventEmitter, OnInit, SimpleChanges} from '@angular/core';
import {TranslateService} from "@ngx-translate/core";
import {SuggestItem} from "../autocomplete/autocomplete.component";
import {NodeHelper} from "../../../core-ui-module/node-helper";
import {PermissionNamePipe} from '../../../core-ui-module/pipes/permission-name.pipe';
import {Authority, AuthorityProfile, Group, IamAuthorities, Organization, RestConnectorService, RestConstants, RestIamService, RestOrganizationService} from '../../../core-module/core.module';
import {Helper} from "../../../core-module/rest/helper";

@Component({
  selector: 'authority-search-input',
  templateUrl: 'authority-search-input.component.html',
  styleUrls: ['authority-search-input.component.scss']
})


export class AuthoritySearchInputComponent{
  @Input() globalSearchAllowed = false;
  /**
   * Do allow any entered authority (not recommended for general use)
   * @type {boolean}
   */
  @Input() allowAny = false;
  /**
   * Group type to filter the groups searched for
   */
  @Input() groupType = "";
    /**
     * maximum number of authorities to fetch in total
     */
    @Input() authorityCount = 50;
  @Input() mode = AuthoritySearchMode.UsersAndGroups;
  @Input() disabled = false;
  @Input() maxSuggestions = 10;
  @Input() inputIcon='search';
  @Input() placeholder = 'WORKSPACE.INVITE_FIELD';
  @Input() hint = '';
  @Output() onChooseAuthority = new EventEmitter();

  inputValue='';
  suggestionGroups: any;
  affiliation=true;
  public addSuggestion(data: any) {
    this.onChooseAuthority.emit(data.originalObject)
  }
  public addAny(data:string){
    let authority=new Authority();
    authority.authorityName=data;
    authority.authorityType=RestConstants.AUTHORITY_TYPE_UNKNOWN;
    this.onChooseAuthority.emit(authority);
  }
  public onSubmit(){
    if(this.allowAny) {
        this.addAny(this.inputValue);
    }
  }
  constructor(private iam : RestIamService,
              private organization : RestOrganizationService,
              private namePipe : PermissionNamePipe,
              private connector : RestConnectorService){
  }

    private convertData(suggestionGroup: any, authorities: AuthorityProfile[]|Group[]) {
        for (let user of authorities) {
            let group = user.profile.displayName != null;
            let item = new SuggestItem(user.authorityName, group ? user.profile.displayName : NodeHelper.getUserDisplayName((user as AuthorityProfile)), group ? 'group' : 'person', '');
            item.originalObject = user;
            item.secondaryTitle = this.namePipe.transform(user,{field:'secondary'});
            suggestionGroup.push(item);
        }
    }

    public updateSuggestions(event : any){
    if(event instanceof SuggestItem){
      this.addSuggestion(event);
      this.inputValue='';
      this.suggestionGroups=null;
      return;
    }
    this.suggestionGroups=[
        {label:'WORKSPACE.INVITE_LOCAL_RESULTS',values:[]}
    ];
    if(event.length<2)
        return;
    if(this.mode==AuthoritySearchMode.UsersAndGroups) {
        if(this.globalSearchAllowed) {
            this.suggestionGroups.push({label: 'WORKSPACE.INVITE_GLOBAL_RESULTS', values: []});
        }
        this.iam.searchAuthorities(event, false, this.groupType).subscribe(
            (authorities: IamAuthorities) => {
                if (this.inputValue != event)
                    return;
                this.convertData(this.suggestionGroups[0].values, authorities.authorities);
                if (authorities.authorities.length == 0)
                    this.suggestionGroups.splice(0, 1);
                if (this.globalSearchAllowed) {
                    this.iam.searchAuthorities(event, true, this.groupType).subscribe(
                        (authorities2: IamAuthorities) => {
                            if (this.inputValue != event)
                                return;
                            // leave out all local existing persons
                            authorities2.authorities = authorities2.authorities.filter((authority) => Helper.indexOfObjectArray(authorities.authorities, 'authorityName', authority.authorityName) == -1);
                            this.convertData(this.suggestionGroups[this.suggestionGroups.length - 1].values, authorities2.authorities);
                            if (authorities2.authorities.length == 0)
                                this.suggestionGroups.splice(1, 1);

                        });
                }
            });
    }
    if(this.mode==AuthoritySearchMode.Organizations) {
        this.organization.getOrganizations(event).subscribe((orgs) => {
            if (this.inputValue != event)
                return;
            this.convertData(this.suggestionGroups[0].values,orgs.organizations);
        });
    }
  }
}
export enum AuthoritySearchMode{
    UsersAndGroups="UsersAndGroups",
    Organizations="Organizations"
}
