
import {Component, Input, Output, EventEmitter, HostListener, ChangeDetectorRef, ApplicationRef} from "@angular/core";
import {
    Group, IamGroups, IamUsers, NodeList, IamUser, IamAuthorities,
    Authority, OrganizationOrganizations, Organization, ToolPermission
} from '../../../common/rest/data-object';
import {Toast} from "../../../common/ui/toast";
import {ActivatedRoute} from "@angular/router";
import {RestIamService} from "../../../common/rest/services/rest-iam.service";
import {TranslateService} from "@ngx-translate/core";
import {RestConnectorService} from "../../../common/rest/services/rest-connector.service";
import {OptionItem} from "../../../common/ui/actionbar/option-item";
import {DialogButton} from "../../../common/ui/modal-dialog/modal-dialog.component";
import {UIAnimation} from "../../../common/ui/ui-animation";
import {SuggestItem} from "../../../common/ui/autocomplete/autocomplete.component";
import {NodeHelper} from "../../../common/ui/node-helper";
import {RestConstants} from "../../../common/rest/rest-constants";
import {RestOrganizationService} from "../../../common/rest/services/rest-organization.service";
import {RestNodeService} from "../../../common/rest/services/rest-node.service";
import {ConfigurationService} from "../../../common/services/configuration.service";
import {Helper} from "../../../common/helper";
import {trigger} from "@angular/animations";
import {ListItem} from "../../../common/ui/list-item";
import {RestAdminService} from '../../../common/rest/services/rest-admin.service';
import {AuthorityNamePipe} from '../../../common/ui/authority-name.pipe';
@Component({
  selector: 'toolpermission-manager',
  templateUrl: 'toolpermission-manager.component.html',
  styleUrls: ['toolpermission-manager.component.scss'],
  animations: [
      trigger('fade', UIAnimation.fade()),
      trigger('cardAnimation', UIAnimation.cardAnimation())
  ]
})
export class ToolpermissionManagerComponent {
  isLoading=false;
  addName="";
  creatingToolpermission=false;
  static STATUS_ALLOWED="ALLOWED";
  static STATUS_DENIED="DENIED";
  static STATUS_UNDEFINED="UNDEFINED";
  static STATUS_UNKNOWN="UNKNOWN";
  static GROUPS:any=[{name:"SHARING",icon:"share",permissions:[
        RestConstants.TOOLPERMISSION_INVITE,
        RestConstants.TOOLPERMISSION_INVITE_STREAM,
        RestConstants.TOOLPERMISSION_INVITE_LINK,
        RestConstants.TOOLPERMISSION_INVITE_SHARE,
        RestConstants.TOOLPERMISSION_GLOBAL_AUTHORITY_SEARCH,
        RestConstants.TOOLPERMISSION_GLOBAL_AUTHORITY_SEARCH_SHARE,
        RestConstants.TOOLPERMISSION_GLOBAL_AUTHORITY_SEARCH_FUZZY,
        RestConstants.TOOLPERMISSION_INVITE_HISTORY,
    ]},
    {name:"LICENSING",icon:"copyright",permissions:[
        RestConstants.TOOLPERMISSION_INVITE_ALLAUTHORITIES,
        RestConstants.TOOLPERMISSION_LICENSE,
        RestConstants.TOOLPERMISSION_HANDLESERVICE,
    ]},
    {name:"DATA_MANAGEMENT",icon:"folder",permissions:[
        RestConstants.TOOLPERMISSION_WORKSPACE,
        RestConstants.TOOLPERMISSION_UNCHECKEDCONTENT
    ]},
    {name:"SAFE",icon:"lock",permissions:[
        RestConstants.TOOLPERMISSION_CONFIDENTAL,
        RestConstants.TOOLPERMISSION_INVITE_SAFE,
        RestConstants.TOOLPERMISSION_INVITE_SHARE_SAFE,
        RestConstants.TOOLPERMISSION_GLOBAL_AUTHORITY_SEARCH_SAFE,
        RestConstants.TOOLPERMISSION_GLOBAL_AUTHORITY_SEARCH_SHARE_SAFE,
    ]},
    {name:"COLLECTIONS",icon:"layers",permissions:[
      RestConstants.TOOLPERMISSION_COLLECTION_EDITORIAL,
        RestConstants.TOOLPERMISSION_COLLECTION_CURRICULUM,
        RestConstants.TOOLPERMISSION_COLLECTION_PINNING,
        RestConstants.TOOLPERMISSION_COLLECTION_FEEDBACK,
    ]},
    {name:"MANAGEMENT",icon:"settings",permissions:[
        RestConstants.TOOLPERMISSION_USAGE_STATISTIC,
    ]},
    {name:"CONNECTORS",icon:"edit"},
    {name:"OTHER",icon:"help"}
  ];
  changing: string[]=[];
  getGroups(){
    return ToolpermissionManagerComponent.GROUPS;
  }
  getToolpermissionsForGroup(group:any){
    if(group.permissions){
      return group.permissions;
    }
    let permissions=Object.keys(this.permissions);
    if(group.name=="CONNECTORS") {
        return permissions.filter((p) => p.startsWith("TOOLPERMISSION_CONNECTOR"));
    }
    // filter "OTHER"
    for(let group of ToolpermissionManagerComponent.GROUPS){
      if(group.permissions){
        for(let tp of group.permissions){
          let pos=permissions.indexOf(tp);
          if(pos!=-1) {
              permissions.splice(pos, 1);
          }
        }
      }
      else if(group.name=="CONNECTORS"){
          permissions=permissions.filter((p)=>!p.startsWith("TOOLPERMISSION_CONNECTOR"));
      }
    }
    return permissions;
  }
  private _authority: any;
  name:string;
  @Input() set authority(authority:any){
    if(authority==null)
      return;
    this._authority=authority;
    this.isLoading=true;
    this.name=new AuthorityNamePipe(this.translate).transform(authority,null);
    this.refresh();
  }
  @Output() onClose = new EventEmitter();
  permissions: ToolPermission|any;
  allow: any;
  allowInit: any;
  deny: any;
  denyInit: any;

  constructor(private toast: Toast,
              private admin : RestAdminService,
              private node : RestNodeService,
              private translate : TranslateService,
              private iam: RestIamService) {

  }
  close(){
    this.onClose.emit();
  }
  change(key:string){
    this.changing.push(key);
    this.admin.setToolpermissions(this._authority.authorityName,this.getPermissions()).subscribe(()=>{
        /*this.toast.toast('PERMISSIONS.TOOLPERMISSIONS.SAVED');
        this.close();*/
        this.refresh(()=>{
            let i=this.changing.indexOf(key);
            if(i!=-1){
                this.changing.splice(i,1);
            }
        });
    },(error:any)=>{
        this.toast.error(error);
    });
  }
  getEffective(key:string) {
    if(this.deny[key]){
      return ToolpermissionManagerComponent.STATUS_DENIED;
    }
    if(this.allow[key] && this.permissions[key].effective!=ToolpermissionManagerComponent.STATUS_DENIED){
      return ToolpermissionManagerComponent.STATUS_ALLOWED;
    }
    if(!this.denyInit[key] && this.permissions[key].effective==ToolpermissionManagerComponent.STATUS_DENIED){
      return ToolpermissionManagerComponent.STATUS_DENIED;
    }
    if(this.allow[key]!=this.allowInit[key] || this.deny[key]!=this.denyInit[key]) {
      return ToolpermissionManagerComponent.STATUS_UNKNOWN;
    }
    return this.permissions[key].effective;
  }
  isImplicit(key:string) {
    if(this._authority.authorityType==RestConstants.AUTHORITY_TYPE_EVERYONE){
        return false;
    }
    if(this.getEffective(key)==ToolpermissionManagerComponent.STATUS_UNDEFINED)
        return false;
    if(this.deny[key]){
        return false;
    }
    if(this.allow[key] && this.permissions[key].effective==ToolpermissionManagerComponent.STATUS_DENIED){
        return true;
    }
    return !this.allow[key];
  }
  getImplicitDetail(key:string){
      let names=[];
      for(let group of this.permissions[key].effectiveSource){
          if(group.authorityType==RestConstants.AUTHORITY_TYPE_EVERYONE){
              names.push(this.translate.instant("PERMISSIONS.TOOLPERMISSIONS.EVERYONE_ALLOWED"));
          }
          else{
              names.push(new AuthorityNamePipe(this.translate).transform(group, null));
          }
      }
      return this.translate.instant("PERMISSIONS.TOOLPERMISSIONS.INHERIT_DETAIL",{memberships:names.join(", ")});
  }

  private getPermissions() {
      let result:any={};
      for(let key in this.permissions){
        if(this.allow[key]){
          result[key]=ToolpermissionManagerComponent.STATUS_ALLOWED;
        }
        else if(this.deny[key]){
          result[key]=ToolpermissionManagerComponent.STATUS_DENIED;
        }
      }
      return result;
  }

    private refresh(callback:Function=null) {
        this.admin.getToolpermissions(this._authority.authorityName).subscribe((data:any)=>{
            this.isLoading=false;
            this.permissions=data;
            this.allow={};
            this.deny={};
            for(let key in this.permissions){
                let value=this.permissions[key].explicit;
                this.allow[key]=value==ToolpermissionManagerComponent.STATUS_ALLOWED;
                this.deny[key]=value==ToolpermissionManagerComponent.STATUS_DENIED;
            }
            this.allowInit=Helper.deepCopy(this.allow);
            this.denyInit=Helper.deepCopy(this.deny);
            if(callback) callback();
        },(error:any)=>{
            this.toast.error(error);
            this.close();
        });
    }
    createToolpermission(){
        this.creatingToolpermission=true;
        this.admin.addToolpermission(this.addName).subscribe(()=>{
            this.toast.toast("PERMISSIONS.TOOLPERMISSIONS.ADDED",{name:this.addName});
            this.addName="";
            this.creatingToolpermission=false;
            this.refresh();
        },(error)=>{
            this.creatingToolpermission=false;
            this.toast.error(error);
        })
    }
    getTpConnector(tp:string){
      tp=tp.substring("TOOLPERMISSION_CONNECTOR_".length);
      if(tp.indexOf("_safe")!=-1) tp=tp.substring(0,tp.indexOf("_safe"));
      let connector=this.translate.instant('CONNECTOR.'+tp+'.NAME');
      return connector;
    }
    getTpSafe(tp:string){
        return tp.endsWith("_safe");
    }
}
