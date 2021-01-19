import {
  Component, Input, EventEmitter, Output, ViewChild, ElementRef, HostListener,
  ApplicationRef, AfterViewInit
} from '@angular/core';
import {RestNodeService} from "../../../common/rest/services/rest-node.service";
import {
    Node, NodeList, NodePermissions, Permission, Permissions, LocalPermissions,
    NodeWrapper, IamUsers, IamGroups, NodeShare, IamAuthorities, LoginResult, Authority, Collection, UsageList, CollectionUsage
} from '../../../common/rest/data-object';
import {Toast} from "../../../common/ui/toast";
import {RestConstants} from "../../../common/rest/rest-constants";
import {Subject} from "rxjs";
import {RestIamService} from "../../../common/rest/services/rest-iam.service";
import {SuggestItem} from "../../../common/ui/autocomplete/autocomplete.component";
import {RestConnectorService} from "../../../common/rest/services/rest-connector.service";
import {TranslateService} from "@ngx-translate/core";
import {NodeHelper} from "../../../common/ui/node-helper";
import {RestHelper} from "../../../common/rest/rest-helper";
import {Helper} from "../../../common/helper";
import {trigger} from "@angular/animations";
import {UIAnimation} from "../../../common/ui/ui-animation";
import {RestUsageService} from '../../../common/rest/services/rest-usage.service';
import {UIHelper} from '../../../common/ui/ui-helper';
import {UIConstants} from '../../../common/ui/ui-constants';
import {RestCollectionService} from '../../../common/rest/services/rest-collection.service';
import {ConfigurationService} from "../../../common/services/configuration.service";
import {DialogButton} from "../../../common/ui/modal-dialog/modal-dialog.component";

@Component({
  selector: 'workspace-share',
  templateUrl: 'share.component.html',
  styleUrls: ['share.component.scss'],
  animations: [
    trigger('fade', UIAnimation.fade()),
    trigger('cardAnimation', UIAnimation.cardAnimation())
  ]
})
export class WorkspaceShareComponent implements AfterViewInit{
  public ALL_PERMISSIONS=["All","Read","ReadPreview","ReadAll","Write","Delete",
    "DeleteChildren","DeleteNode","AddChildren","Consumer","ConsumerMetadata",
    "Editor","Contributor","Collaborator","Coordinator",
    "Publisher","ReadPermissions","ChangePermissions","CCPublish","Comment","Feedback","Deny"];
  public PERMISSIONS_FORCES:any= [
    ["Read",["ConsumerMetadata"]],
    ["Read",["Consumer"]],
    ["ReadPreview",["Consumer"]],
    ["ReadAll",["Consumer"]],
    ["Comment",["Consumer"]],
    ["Feedback",["Consumer"]],
    ["Write",["Editor"]],
    ["DeleteChildren",["Delete"]],
    ["DeleteNode",["Delete"]],
    ["AddChildren",["Contributor"]],
    ["ReadPermissions",["Contributor"]],
    ["Contributor",["Collaborator"]]
  ];
  public INVITE="INVITE";
  public INVITED="INVITED";
  public ADVANCED="ADVANCED";
  initialState: string;
  public tab=this.INVITE;
  private currentType=[RestConstants.ACCESS_CONSUMER,RestConstants.ACCESS_CC_PUBLISH];
  private inherited : boolean;
  private notifyUsers = true;
  private notifyMessage : string;
  private inherit : Permission[]=[];
  private permissions : Permission[]=[];
  public permissionsUser : Permission[];
  public permissionsGroup : Permission[];
  private newPermissions : Permission[]=[];
  inheritAccessDenied = false;
  public owner : Permission;
  public linkEnabled : Permission;
  public linkDisabled : Permission;
  public link = false;
  private _node : Node;
  dialogTitle : string;
  dialogMessage : string;
  dialogCancel : Function;
  dialogButtons : DialogButton[];

  private searchStr: string;
  private inheritAllowed=false;
  private isSharedScope=false;
  private globalSearch=false;
  private globalAllowed=false;
  private fuzzyAllowed=false;
  public history: Node;
  public linkNode: Node;
  public showLink: boolean;
  public isAdmin: boolean;
  public publishPermission: boolean;
  public doiPermission: boolean;
  public publishInherit: boolean;
  public publishActive: boolean;
  public doiActive: boolean;
  public doiDisabled: boolean;
  private originalPermissions: LocalPermissions;
  private isSafe = false;
  collectionColumns=UIHelper.getDefaultCollectionColumns();
  collections: CollectionUsage[];
  // store authorities marked for deletion
  public deletedPermissions:string[]=[];
  public deletedUsages:any[]=[];
  usages: any;
  showCollections = false;

    ngAfterViewInit(): void {
        setTimeout(()=>UIHelper.setFocusOnCard());
    }
  public isCollection(){
    if(this._node==null)
      return true;
    return this._node.aspects.indexOf(RestConstants.CCM_ASPECT_COLLECTION)!=-1;
  }
  public openLink(){
    this.linkNode=this._node;
  }
  private addSuggestion(data: any) {
    this.addAuthority(data);
  }
  @Input() sendMessages=true;
  @Input() sendToApi=true;
  @Input() currentPermissions:LocalPermissions=null;
  @Input() set nodeId (node : string){
    if(node)
      this.nodeApi.getNodeMetadata(node,[RestConstants.ALL]).subscribe((data:NodeWrapper)=>{
        this.setNode(data.node);
      });
  }
  @Input() set node (node : Node){
    this.setNode(node);
  }
  setNode (node : Node){
    this._node=node;
    if(node==null)
      return;
    if(this._node.isDirectory)
      this.currentType=[RestConstants.ACCESS_CONSUMER];
    if(this.currentPermissions) {
      this.originalPermissions=Helper.deepCopy(this.currentPermissions);
      this.setPermissions(this.currentPermissions.permissions);
      this.inherited = this.currentPermissions.inherited;
      this.showLink=false;
    }
    else {
      this.showLink=true;
      this.updateNodeLink();
      this.nodeApi.getNodePermissions(node.ref.id).subscribe((data: NodePermissions) => {
        //this.inherit=data.permissions.inheritedPermissions;
        if(data.permissions) {
          this.originalPermissions=Helper.deepCopy(data.permissions.localPermissions);
          this.setPermissions(data.permissions.localPermissions.permissions)
          this.inherited = data.permissions.localPermissions.inherited;
          this.updatePublishState();
          this.initialState=this.getState();
          this.doiActive = NodeHelper.isDOIActive(node,data.permissions);
          this.doiDisabled = this.doiActive;
        }
      },(error:any)=>this.toast.error(error));
      this.reloadUsages();
    }
    if(node.parent && node.parent.id) {
      this.nodeApi.getNodePermissions(node.parent.id).subscribe((data: NodePermissions) => {
        if (data.permissions) {
          this.inherit = data.permissions.inheritedPermissions;
          this.removePermissions(this.inherit, 'OWNER');
          this.removePermissions(data.permissions.localPermissions.permissions, 'OWNER');
          this.inherit = this.mergePermissions(this.inherit,data.permissions.localPermissions.permissions);
          this.updatePublishState();
          this.initialState=this.getState();
        }

      }, (error: any) => {
          this.inheritAccessDenied=true;
      });
      this.nodeApi.getNodeParents(node.ref.id).subscribe((data) => {
        //this.inheritAllowed = !this.isCollection() && data.nodes.length > 1;
        // changed in 4.1 to keep inherit state of collections
        this.inheritAllowed = data.nodes.length > 1;
        this.isSharedScope = data.scope === 'SHARED_FILES';
        this.updateToolpermissions();
      },(error)=>{
          // this can be caused if the node is somewhere at a location not fully visible to the user
        this.updateToolpermissions();
        this.inheritAllowed=true;
      });
    }
    this.connector.isLoggedIn().subscribe((data:LoginResult)=>{
      this.isAdmin=data.isAdmin;
    });
    if(node.ref.id) {
      this.nodeApi.getNodeMetadata(node.ref.id, [RestConstants.ALL]).subscribe((data: NodeWrapper) => {
        let authority = data.node.properties[RestConstants.CM_CREATOR][0];
        let user = data.node.createdBy;

        if (data.node.properties[RestConstants.CM_OWNER]) {
          authority = data.node.properties[RestConstants.CM_OWNER][0];
          user = data.node.owner;
        }
        this.owner = new Permission();
        this.owner.authority = {authorityName: authority, authorityType: "USER"};
        (this.owner as any).user = user;
        this.owner.permissions = ["Owner"];
      });
    }
    else{
      this.updatePublishState();
    }
  }
  @Output() onClose=new EventEmitter();
  @Output() onLoading=new EventEmitter();
  private showChooseType = false;
  private showChooseTypeList : Permission;
  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if(event.key=="Escape"){
      event.stopPropagation();
      event.preventDefault();
      if(this.history){
        this.history=null;
        return;
      }
      if(this.showCollections){
        this.showCollections=false;
        return;
      }
      if(this.linkNode){
        this.linkNode=null;
        return;
      }
      this.cancel();
      return;
    }
  }
  public setTab(tab : string){
    this.tab=tab;
  }
  private chooseType(){
    this.showChooseType=true;
  }
  private chooseTypeList(p : Permission){
    this.showChooseTypeList=p;
  }
  isDeleted(p : Permission){
      return this.deletedPermissions.indexOf(p.authority.authorityName)!=-1;
  }
  private removePermission(p : Permission){
      if(this.isDeleted(p))
          this.deletedPermissions.splice(this.deletedPermissions.indexOf(p.authority.authorityName),1);
      else
          this.deletedPermissions.push(p.authority.authorityName);
      this.updatePublishState();
      /*
      if(this.newPermissions.indexOf(p)!=-1)
      this.newPermissions.splice(this.newPermissions.indexOf(p),1);
    this.permissions.splice(this.permissions.indexOf(p),1);
    this.setPermissions(this.permissions);
    this.updatePublishState();
    */
  }
  private setType(type : any){
    this.currentType=type.permissions;
    if(type.wasMain)
      this.showChooseType=false;
    for(let permission of this.newPermissions){
      permission.permissions=Helper.deepCopy(this.currentType);
    }
  }
  public cancel(){
    this.onClose.emit();
  }
  private contains(permissions : Permission[],permission : Permission,comparePermissions:boolean) : boolean{
    for(let p of permissions) {
      if (p.authority.authorityName == permission.authority.authorityName) {
        if (!comparePermissions)
          return true;
        if (Helper.arrayEquals(p.permissions, permission.permissions))
          return true;
      }
    }
    return false;
  }
  hasUsages(){
      return this.usages && Object.keys(this.usages).length;
  }
  public showHistory(){
    this.history=this._node;
  }
  private addAuthority(selected : any){
    if(selected==null)
      return;
    let permission : any =new Permission();
    permission.authority = {
      authorityName: selected.authorityName,
      authorityType: selected.authorityType
    };
    if(selected.authorityType=='USER'){
      permission.user=selected.profile;
    }
    else{
      permission.group=selected.profile;
    }
    permission.permissions=this.currentType;
    permission=Helper.deepCopy(permission);
    if(this.deletedPermissions.indexOf(permission.authority.authorityName)!=-1){
      this.deletedPermissions.splice(this.deletedPermissions.indexOf(permission.authority.authorityName),1);
    }
    else if(!this.contains(this.permissions,permission,false)) {
      this.newPermissions.push(permission);
      this.permissions.push(permission);
      this.setPermissions(this.permissions);
    }
    else
      this.toast.error(null,"WORKSPACE.PERMISSION_AUTHORITY_EXISTS");
    this.searchStr="";
  }
  private isNewPermission(p : Permission){
    if(!this.originalPermissions || !this.originalPermissions.permissions)
      return true;
    return !this.contains(this.originalPermissions.permissions,p,true);
    //return this.contains(this.newPermissions,p);
  }
  filterDisabledPermissions(permissions:Permission[]){
    let result:Permission[]=[];
    if(!permissions)
      return result;
    for(let p of permissions){
      if(this.deletedPermissions.indexOf(p.authority.authorityName)==-1)
        result.push(p);
    }
    return result;
  }
    private save(){
    if(this.permissions!=null) {
      this.onLoading.emit(true);
      let inherit=this.inherited && this.inheritAllowed && !this.isCollection();
      let permissions=Helper.deepCopy(this.permissions);
      permissions=permissions.filter((p:Permission)=>!this.isDeleted(p));
      let permissionsCopy=RestHelper.copyAndCleanPermissions(permissions,inherit);
        if(!this.sendToApi) {
        this.onClose.emit(this.getEmitObject(RestHelper.copyPermissions(permissions,inherit)));
        return;
      }
      this.nodeApi.setNodePermissions(this._node.ref.id,permissionsCopy,this.notifyUsers && this.sendMessages,this.notifyMessage,false,this.doiPermission && this.allowDOI() && this.doiActive && this.publishActive).subscribe(() => {
          this.updateUsages(RestHelper.copyPermissions(permissions,inherit));
        },
        (error : any)=> {
          this.toast.error(error);
          this.onLoading.emit(false);
        }
      );
    }
  }
  constructor(private nodeApi : RestNodeService,
              private translate : TranslateService,
              private collectionService : RestCollectionService,
              private applicationRef : ApplicationRef,
              private config : ConfigurationService,
              private toast : Toast,
              private usageApi : RestUsageService,
              private iam : RestIamService,
              private connector:RestConnectorService){
    //this.dataService=new SearchData(iam);

    this.linkEnabled=new Permission();
    this.linkEnabled.authority={authorityName:this.translate.instant('WORKSPACE.SHARE.LINK_ENABLED_INFO'),authorityType:"LINK"};
    this.linkEnabled.permissions=[RestConstants.PERMISSION_CONSUMER];
    this.linkDisabled=new Permission();
    this.linkDisabled.authority={authorityName:this.translate.instant('WORKSPACE.SHARE.LINK_DISABLED_INFO'),authorityType:"LINK"};
    this.linkDisabled.permissions=[];

    this.connector.isLoggedIn().subscribe((data:LoginResult)=>{
      this.isSafe=data.currentScope!=null;
    });
  }
  updateToolpermissions(){
    this.connector.hasToolPermission(this.isSafe ?
        this.isSharedScope ? RestConstants.TOOLPERMISSION_GLOBAL_AUTHORITY_SEARCH_SHARE_SAFE : RestConstants.TOOLPERMISSION_GLOBAL_AUTHORITY_SEARCH_SAFE :
        this.isSharedScope ? RestConstants.TOOLPERMISSION_GLOBAL_AUTHORITY_SEARCH_SHARE : RestConstants.TOOLPERMISSION_GLOBAL_AUTHORITY_SEARCH
    ).subscribe((has:boolean)=>this.globalAllowed=has);
    this.connector.hasToolPermission(RestConstants.TOOLPERMISSION_GLOBAL_AUTHORITY_SEARCH_FUZZY).subscribe((has:boolean)=>this.fuzzyAllowed=has);
    this.connector.hasToolPermission(RestConstants.TOOLPERMISSION_INVITE_ALLAUTHORITIES).subscribe((has:boolean)=>this.publishPermission=has);
    this.connector.hasToolPermission(RestConstants.TOOLPERMISSION_HANDLESERVICE).subscribe((has:boolean)=>this.doiPermission=has);
  }
  private updatePermissionInfo(){
    let type:string[];
    for(let permission of this.newPermissions){
      if(type && !Helper.arrayEquals(type,permission.permissions)){
        this.currentType=[];
        return;
      }
      type=permission.permissions;
    }
    if(type)
      this.currentType=type;
  }
  private removePermissions(permissions:Permission[], remove : string) {
    for(let i=0;i<remove.length;i++){
      if(permissions[i] && permissions[i].authority.authorityType==remove){
        permissions.splice(i, 1);
        i--;
      }
    }
  }
  public setPermission(permission:Permission,name:string,status:any){
    console.log("set "+name+" "+status);
    if(status.srcElement.checked){
      if(permission.permissions.indexOf(name)==-1)
        permission.permissions.push(name);
    }
    else{
      let index=permission.permissions.indexOf(name);
      if(index!=-1){
        permission.permissions.splice(index,1);
      }
    }
    this.applicationRef.tick();
  }
  public isImplicitPermission(permission:Permission,name:string){
    //if(name=="Consumer") // this is the default permission, can't be removed
    //  return true;
    if(name!="All" && permission.permissions.indexOf("All")!=-1) // coordinator implies all permissions
      return true;
    if(name!="Coordinator" && permission.permissions.indexOf("Coordinator")!=-1) // coordinator implies all permissions
      return true;
    for(let array of this.PERMISSIONS_FORCES) {
      if(array[0]!=name)
        continue;
      let list = array[1];
      if (!list)
        return false;
      let result=true;
      for (let perm of list) {
        if (perm == name)
          continue;
        if (this.hasImplicitPermission(permission, perm))
          continue;
        result=false;
        break;
      }
      if(result)
        return true;
    }
    return false;
  }

  public hasImplicitPermission(permission:Permission,name:string){
    if(permission.permissions.indexOf(name)!=-1)
      return true;
    return this.isImplicitPermission(permission,name);
  }
  private setPermissions(permissions: Permission[]) {
    if(permissions==null)
      permissions=[];
    this.permissions=permissions;
    this.permissionsUser=this.permissions.slice();
    this.permissionsGroup=this.permissions.slice();
    this.removePermissions(this.permissionsUser,RestConstants.AUTHORITY_TYPE_GROUP);
    this.removePermissions(this.permissionsUser,RestConstants.AUTHORITY_TYPE_EVERYONE);
    this.removePermissions(this.permissionsGroup,RestConstants.AUTHORITY_TYPE_USER);
  }

  public updateNodeLink() {
    this.nodeApi.getNodeShares(this._node.ref.id,RestConstants.SHARE_LINK).subscribe((data:NodeShare[])=>{
      this.link=data.length>0 && data[0].expiryDate!=0;
    });
  }
  allowDOI(){
    if(!this._node)
      return false;
    return !this._node.isDirectory && !this.publishInherit && this.publishActive && this.doiPermission;
  }
  private updatePublishState() {
    this.publishInherit=this.inherited && this.getAuthorityPos(this.inherit,RestConstants.AUTHORITY_EVERYONE)!=-1;
    this.publishActive=this.publishInherit || this.getAuthorityPos(this.permissions,RestConstants.AUTHORITY_EVERYONE)!=-1 && this.deletedPermissions.indexOf(RestConstants.AUTHORITY_EVERYONE)==-1;
  }

  private getAuthorityPos(permissions: Permission[], authority: string) {
    let i=0;
    for(let permission of permissions){
      if(permission.authority.authorityName==authority)
        return i;
      i++;
    }
    return -1;
  }
  public setPublish(status:boolean,force=false){
    if(status && !force) {
      if (this.config.instant('publishingNotice', false)) {
        this.dialogTitle = 'WORKSPACE.SHARE.PUBLISHING_WARNING_TITLE';
        this.dialogMessage = 'WORKSPACE.SHARE.PUBLISHING_WARNING_MESSAGE';
        this.dialogCancel = () => {
          this.dialogTitle = null;
          this.publishActive = false;
        };
        this.dialogButtons = DialogButton.getYesNo(() => {
          this.dialogCancel();
        }, () => {
          this.publishActive = true;
          this.dialogTitle = null;
          this.setPublish(status, true);
        });
        return;
      }
    }
    if(status && this.doiPermission){
      this.doiActive=true;
    }
    if (this.deletedPermissions.indexOf(RestConstants.AUTHORITY_EVERYONE)!=-1) {
        this.deletedPermissions.splice(this.deletedPermissions.indexOf(RestConstants.AUTHORITY_EVERYONE),1);
    } else {
      let i=this.getAuthorityPos(this.permissions,RestConstants.AUTHORITY_EVERYONE);
      if (i!=-1) {
        this.deletedPermissions.push(RestConstants.AUTHORITY_EVERYONE);
      } else {
        let perm = RestHelper.getAllAuthoritiesPermission();
        perm.permissions = [RestConstants.PERMISSION_CONSUMER];
        this.permissions.push(perm);
      }
    }


    this.setPermissions(this.permissions);
    this.updatePublishState();
  }

  reloadUsages() {
    this.usageApi.getNodeUsagesCollection(this._node.ref.id).subscribe((data)=>{
        this.collections=data;
    });
    this.usageApi.getNodeUsages(this._node.ref.id).subscribe((data:UsageList)=>{
        this.usages = RestUsageService.getNodeUsagesByRepositoryType(data);
        console.log(this.usages);
    });
  }
  openCollection(collection:Collection){
    window.open(UIConstants.ROUTER_PREFIX+"collections?id="+collection.ref.id);
  }

    isStateModified() {
        return this.initialState!=this.getState();
    }

    getState() {
        if(this.publishActive || this.publishInherit){
            return 'PUBLIC';
        }
        for(let perm of this.permissions.concat(this.inherit)){
            if(perm.authority.authorityName!=RestConstants.AUTHORITY_EVERYONE)
                return 'SHARED';
        }
        return 'PRIVATE';
  }

    private updateUsages(permissions:LocalPermissions,pos=0,error=false) {
      if(pos==this.deletedUsages.length){
          this.onLoading.emit(false);
          this.onClose.emit(this.getEmitObject(permissions));
          if(!error) {
              this.toast.toast('WORKSPACE.PERMISSIONS_UPDATED');
          }
          return;
      }
        console.log(this.deletedUsages);
        let usage=this.deletedUsages[pos];
        // collection
        if(usage.collection){
            this.collectionService.removeFromCollection(usage.resourceId,usage.collection.ref.id).subscribe(()=>{
                this.updateUsages(permissions,pos+1);
            },(error)=>{
                this.toast.error(error);
                this.updateUsages(permissions,pos+1,true);
            });
        }
        else{
            this.usageApi.deleteNodeUsage(this._node.ref.id,usage.nodeId).subscribe(()=>{
                this.updateUsages(permissions,pos+1);
            },(error)=>{
                this.toast.error(error);
                this.updateUsages(permissions,pos+1,true);
            });
        }
    }

    private mergePermissions(source: Permission[], add: Permission[]) {
      let merge=source;
      for(let p2 of add){
        // do only add new, unique permissions
        if(merge.filter((p1)=> Helper.objectEquals(p1,p2)).length==0){
            merge.push(p2);
        }
      }
      return merge;
    }

  private getEmitObject(localPermissions: LocalPermissions) {
    return {
      permissions: localPermissions,
      notify: this.notifyUsers,
      notifyMessage: this.notifyMessage
    };
  }

    showShareLink() {
        return !this.isCollection() && this.connector.hasToolPermissionInstant(RestConstants.TOOLPERMISSION_INVITE_LINK);
    }
}
/*
class SearchData extends Subject<CompleterItem[]> implements CompleterData {
  constructor(private iam: RestIamService) {
    super();
  }

  public search(term: string): void {
    console.log("search "+term);
    this.iam.searchUsers(term).subscribe((data : IamUsers)=>{
      let matches:CompleterItem[]=[];
      for(let user of data.users){
        matches.push({
          title: user.authorityName,
          description: null,
          originalObject:user
        });
      }
      this.iam.searchGroups(term).subscribe((data : IamGroups)=>{
        for(let user of data.groups){
          matches.push({
            title: user.profile.displayName,
            description: null,
            originalObject:user
          });
        }
        this.next(matches);
    })

    })
  }

  public cancel() {
    // Handle cancel
  }
}
*/
