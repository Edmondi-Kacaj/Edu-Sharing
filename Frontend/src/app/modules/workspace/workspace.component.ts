import {Component, HostListener} from '@angular/core';
import {TranslateService} from "ng2-translate";
import {Translation} from "../../common/translation";
import {RestNodeService} from "../../common/rest/services/rest-node.service";
import {
  NodeRef, IamUser, NodeWrapper, Node, Version, NodeVersions, LoginResult, NodeList,
  OAuthResult, Collection, Connector, ConnectorList, Type, Filetype
} from "../../common/rest/data-object";
import {RestIamService} from "../../common/rest/services/rest-iam.service";
import {Router, Params, ActivatedRoute, Routes} from "@angular/router";
import {RouterComponent} from "../../router/router.component";
import {OptionItem} from "../../common/ui/actionbar/actionbar.component";
import {DialogButton, ModalDialogComponent} from "../../common/ui/modal-dialog/modal-dialog.component";
import {RestConstants} from "../../common/rest/rest-constants";
import {RestHelper} from "../../common/rest/rest-helper";
import {Toast} from "../../common/ui/toast";
import {TemporaryStorageService} from "../../common/services/temporary-storage.service";
import {UIAnimation} from "../../common/ui/ui-animation";
import {RestConnectorService} from "../../common/rest/services/rest-connector.service";
import {SessionStorageService} from "../../common/services/session-storage.service";
import {environment} from "../../common/rest/environments/environment";
import {NodeHelper} from "../../common/ui/node-helper";
import {UIService} from "../../common/services/ui.service";
import {RestCollectionService} from "../../common/rest/services/rest-collection.service";
import {RestConnectorsService} from "../../common/rest/services/rest-connectors.service";
import {NodeRenderComponent} from "../../common/ui/node-render/node-render.component";
import {KeyEvents} from "../../common/ui/key-events";
import {ConfigurationService} from "../../common/services/configuration.service";
import {FrameEventsService} from "../../common/services/frame-events.service";
import {Title} from "@angular/platform-browser";
import {UIHelper} from "../../common/ui/ui-helper";
import {Http,Response} from "@angular/http";
import {trigger} from "@angular/animations";
import {MdsComponent} from "../../common/ui/mds/mds.component";
import {RestToolService} from "../../common/rest/services/rest-tool.service";
import {UIConstants} from "../../common/ui/ui-constants";

@Component({
  selector: 'workspace-main',
  templateUrl: 'workspace.component.html',
  styleUrls: ['workspace.component.scss'],
  animations: [
    trigger('fade', UIAnimation.fade()),
    trigger('fadeFast', UIAnimation.fade(UIAnimation.ANIMATION_TIME_FAST)),
    trigger('overlay', UIAnimation.openOverlay(UIAnimation.ANIMATION_TIME_FAST)),
    trigger('fromLeft', UIAnimation.fromLeft()),
    trigger('fromRight',UIAnimation.fromRight())
  ]
})
export class WorkspaceMainComponent{
  private isRootFolder : boolean;
  private homeDirectory : string;
  private sharedFolders : Node[]=[];
  private path : Node[]=[];
  private selectedNode : String;
  private metadataNode : String;
  private root = "MY_FILES";
  private static VALID_ROOTS=['MY_FILES','SHARED_FILES','MY_SHARED_FILES','TO_ME_SHARED_FILES','WORKFLOW_RECEIVE','RECYCLE'];
  private static VALID_ROOTS_NODES=[RestConstants.USERHOME,'-shared_files-','-my_shared_files-','-to_me_shared_files-'];
  private explorerOptions : OptionItem[]=[];
  private actionOptions : OptionItem[]=[];
  private selection : Node[]=[];
  public fileIsOver: boolean = false;

  private dialogTitle : string;
  private dialogCancelable = false;
  private dialogMessage : string;
  private dialogMessageParameters : any;
  private dialogButtons : DialogButton[];

  private showAddDesktop = false;
  private showAddMobile = false;

  private showSelectRoot = false;
  public showUploadSelect = false;
  private createConnectorName : string;
  private createConnectorType : Connector;
  private addFolderName : string;

  private filesToUpload : FileList;
  public globalProgress = false;
  public editNodeMetadata : Node;
  private createMds : string;
  private editNodeLicense : Node[];
  private editNodeAllowReplace : boolean;
  private nodeDisplayedVersion : string;
  private createAllowed : boolean;
  private currentFolder : any|Node;
  private user : IamUser;
  public searchQuery : string;
  public isSafe = false;
  private isLoggedIn = false;
  public addNodesToCollection : Node[];
  private dropdownPosition: string;
  private dropdownLeft: string;
  private dropdownRight: string;
  private dropdownTop: string;
  private dropdownBottom: string;
  private connectorList: ConnectorList;
  private nodeOptions: OptionItem[]=[];
  private currentNode: Node;
  public mainnav=true;
  private timeout: string;
  private timeIsValid = false;
  private viewToggle: OptionItem;
  private isAdmin=false;
  public isBlocked=false;
  private isGuest: boolean;
  private currentNodes: Node[];
  private appleCmd=false;
  public workflowNode: Node;
  private reurl: string;
  private mdsParentNode: Node;
  public showLtiTools=false;
  private oldParams: Params;
  private hideDialog() : void{
    this.dialogTitle=null;
  }
  private sharedNode : Node;
  public contributorNode : Node;
  public shareLinkNode : Node;
  private viewType = 0;
  private infoToggle: OptionItem;
  @HostListener('window:beforeunload', ['$event'])
  beforeunloadHandler(event:any) {
    if(this.isSafe){
      this.connector.logoutSync();
    }
  }
  @HostListener('document:keyup', ['$event'])
  handleKeyboardEventUp(event: KeyboardEvent) {
    if(event.keyCode==91 || event.keyCode==93)
      this.appleCmd=false;
  }
  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if(event.keyCode==91 || event.keyCode==93){
      this.appleCmd=true;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    let clip=(this.storage.get("workspace_clipboard") as ClipboardObject);
    let fromInputField=KeyEvents.eventFromInputField(event);
    let hasOpenWindow=this.editNodeLicense || this.editNodeMetadata || this.createConnectorName || this.showUploadSelect || this.dialogTitle || this.addFolderName || this.sharedNode || this.workflowNode;
    if(event.code=="KeyX" && (event.ctrlKey || this.appleCmd) && this.selection.length && !hasOpenWindow && !fromInputField){
      this.cutCopyNode(null,false);
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if(event.code=="KeyC" && (event.ctrlKey || this.appleCmd) && this.selection.length && !hasOpenWindow && !fromInputField){
      this.cutCopyNode(null,true);
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if(event.code=="KeyV" && (event.ctrlKey || this.appleCmd) && clip && !hasOpenWindow && !fromInputField){
      this.pasteNode();
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if(event.code=="Delete" && !hasOpenWindow && !fromInputField && this.selection.length){
      this.deleteNode();
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if(event.key=="Escape"){
      if(this.shareLinkNode!=null){
        this.shareLinkNode=null;
        return;
      }
      if(this.workflowNode!=null){
        this.workflowNode=null;
        return;
      }

      if(this.addFolderName!=null){
        this.addFolderName=null;
        return;
      }
      if(this.showUploadSelect){
        this.showUploadSelect=false;
        return;
      }
      if(this.createConnectorName!=null){
        this.createConnectorName=null;
        return;
      }
      if(this.metadataNode!=null){
        this.closeMetadata();
        return;
      }

    }
  }
  constructor(private toast : Toast,
              private route : ActivatedRoute,
              private router : Router,
              private translate : TranslateService,
              private storage : TemporaryStorageService,
              private config: ConfigurationService,
              private connectors : RestConnectorsService,
              private collectionApi : RestCollectionService,
              private toolService : RestToolService,
              private session : SessionStorageService,
              private iam : RestIamService,
              private node : RestNodeService,
              private ui : UIService,
              private title : Title,
              private http : Http,
              private event : FrameEventsService,
              private connector : RestConnectorService) {
    Translation.initialize(translate,this.config,this.session,this.route).subscribe(()=>{
      UIHelper.setTitle('WORKSPACE.TITLE',title,translate,config);
    });
    this.connector.setRoute(this.route);
    this.globalProgress=true;
    this.initialize();
    this.explorerOptions=this.getOptions([new Node()],true);
    //this.nodeOptions.push(new OptionItem("DOWNLOAD", "cloud_download", (node:Node) => this.downloadNode(node)));
  }
  private showTimeout(){
    return this.timeIsValid && this.dialogTitle!='WORKSPACE.AUTOLOGOUT' &&
      (this.isSafe || !this.isSafe && this.config.instant('sessionExpiredDialog',{show:true}).show);
  }
  private updateTimeout(){
    let time=this.connector.logoutTimeout - Math.floor((new Date().getTime()-this.connector.lastActionTime)/1000);
    let min=Math.floor(time/60);
    let sec=time%60;
    this.event.broadcastEvent(FrameEventsService.EVENT_SESSION_TIMEOUT,time);
    if(time>=0) {
      this.timeout = this.formatTimeout(min, 2) + ":" + this.formatTimeout(sec, 2);
      this.timeIsValid=true;
    }
    else if(this.showTimeout()){
      this.dialogTitle='WORKSPACE.AUTOLOGOUT';
      this.dialogMessage='WORKSPACE.AUTOLOGOUT_INFO';
      this.dialogCancelable=false;
      this.dialogMessageParameters={minutes:Math.round(this.connector.logoutTimeout/60)};
      this.dialogButtons=[];
      this.dialogButtons.push(new DialogButton("WORKSPACE.RELOGIN",DialogButton.TYPE_PRIMARY,()=>this.goToLogin()));
    }
    else
      this.timeout="";
  }
  private formatTimeout(num:number, size:number) {
    let s = num+"";
    while (s.length < size) s = "0" + s;
    return s;
  }
  private createConnector(event : any){
    let name=event.name+"."+event.type.filetype;
    this.createConnectorName=null;
    let prop=RestHelper.createNameProperty(name);
    prop[RestConstants.LOM_PROP_TECHNICAL_FORMAT]=[event.type.mimetype];
    if(event.type.mimetype=='application/zip') {
      prop[RestConstants.CCM_PROP_CCRESSOURCETYPE] = [event.type.ccressourcetype];
      prop[RestConstants.CCM_PROP_CCRESSOURCESUBTYPE] = [event.type.ccresourcesubtype];
      prop[RestConstants.CCM_PROP_CCRESSOURCEVERSION] = [event.type.ccressourceversion];
    }
    if(event.type.editorType){
      prop[RestConstants.CCM_PROP_EDITOR_TYPE] = [event.type.editorType];
    }
    var win=window.open("",'_blank');
    this.node.createNode(this.currentFolder.ref.id,RestConstants.CCM_TYPE_IO,[],prop,false).subscribe(
      (data : NodeWrapper)=>{
        this.editConnector(data.node,event.type,win,this.createConnectorType);
        this.refresh();
      },
      (error : any)=>{
        win.close();
        if(NodeHelper.handleNodeError(this.toast,event.name,error)==RestConstants.DUPLICATE_NODE_RESPONSE){
          this.createConnectorName=event.name;
        }
      }
    )

  }
  private editConnector(node : Node=null,type : Filetype=null,win : any = null,connectorType : Connector = null){
    this.connectors.openConnector(this.connectorList,this.getNodeList(node)[0],type,win,connectorType);
  }
  private handleDrop(event:any){
    for(let s of event.source) {
      if (event.target.ref.id == s.ref.id || event.target.ref.id==s.parent.id) {
        this.toast.error(null, "WORKSPACE.SOURCE_TARGET_IDENTICAL");
        return;
      }
    }
    if(!event.target.isDirectory){
      this.toast.error(null,"WORKSPACE.TARGET_NO_DIRECTORY");
      return;
    }
    if(event.event.altKey){
      this.toast.error(null,"WORKSPACE.FEATURE_NOT_IMPLEMENTED");
    }
    else if(event.event.ctrlKey){
      this.copyNode(event.target,event.source);
    }
    else{
      this.moveNode(event.target,event.source);
    }
    /*
    this.dialogTitle="WORKSPACE.DRAG_DROP_TITLE";
    this.dialogCancelable=true;
    this.dialogMessage="WORKSPACE.DRAG_DROP_MESSAGE";
    this.dialogMessageParameters={source:event.source.name,target:event.target.name};
    this.dialogButtons=[
      new DialogButton("WORKSPACE.DRAG_DROP_COPY",DialogButton.TYPE_PRIMARY,()=>this.copyNode(event.target,event.source)),
      new DialogButton("WORKSPACE.DRAG_DROP_MOVE",DialogButton.TYPE_PRIMARY,()=>this.moveNode(event.target,event.source)),
    ]
    console.log(event);
    */
  }
  private moveNode(target:Node,source:Node[],position = 0){
    this.globalProgress=true;
    if(position>=source.length){
      this.finishMoveCopy(target,source,false);
      this.globalProgress=false;
      return;
    }
    this.node.moveNode(target.ref.id,source[position].ref.id).subscribe((data:NodeWrapper)=> {
        this.moveNode(target, source, position+1);
      },
      (error : any)=>{
        NodeHelper.handleNodeError(this.toast,source[position].name,error);
        source.splice(position,1);
        this.moveNode(target, source, position+1);
      });
  }
  private copyNode(target:Node,source:Node[],position = 0){
    this.globalProgress=true;
    if(position>=source.length){
      this.finishMoveCopy(target,source,true);
      this.globalProgress=false;
      return;
    }
    this.node.copyNode(target.ref.id,source[position].ref.id).subscribe((data:NodeWrapper)=> {
        this.copyNode(target, source, position+1);
      },
      (error : any)=>{
        NodeHelper.handleNodeError(this.toast,source[position].name,error);
        source.splice(position,1);
        this.copyNode(target, source, position+1);
      });
  }
  private finishMoveCopy(target:Node,source:Node[],copy:boolean){
    this.dialogTitle=null;
    let info:any={
      to:target.name,
      count:source.length,
      mode:this.translate.instant("WORKSPACE."+(copy ? "PASTE_COPY" : "PASTE_MOVE"))
    }
    if(source.length)
      this.toast.toast("WORKSPACE.TOAST.PASTE_DRAG",info);
    this.globalProgress=false;
    this.refresh();
  }
  private initialize(){
    this.route.params.subscribe((params: Params) => {
      this.isSafe = params['mode'] == 'safe';
      this.connector.isLoggedIn().subscribe((data:LoginResult)=>{
        if(data.statusCode!=RestConstants.STATUS_CODE_OK){
          UIHelper.goToLogin(this.router,this.config);
          return;
        }
        this.iam.getUser().subscribe((user : IamUser) => {
          this.user=user;
          this.loadFolders(user);

          let valid=true;
          this.isGuest=data.isGuest;
          if(!data.isValidLogin || data.isGuest){
            valid=false;
          }
          this.isBlocked=!this.connector.hasToolPermissionInstant(RestConstants.TOOLPERMISSION_WORKSPACE);
          this.isAdmin=data.isAdmin;
          if(this.isSafe && data.currentScope!=RestConstants.SAFE_SCOPE)
            valid=false;
          if(!this.isSafe && data.currentScope!=null)
            valid=false;
          if(!valid){
            this.goToLogin();
            return;
          }
          this.connector.scope=this.isSafe ? RestConstants.SAFE_SCOPE : null;
          this.connectors.list().subscribe((data:ConnectorList)=>{
            this.connectorList=data;
          });
          this.isLoggedIn=true;
          this.node.getHomeDirectory().subscribe((data : NodeRef) => {
            this.globalProgress=false;
            this.homeDirectory=data.id;
            this.route.params.forEach((params: Params) => {
              //if(this.isSafe)
              setInterval(()=>this.updateTimeout(),1000);

              this.route.queryParams.subscribe((params: Params) => {
                let needsUpdate=false;
                if(this.oldParams){
                  for(var key in params){
                    if(params[key]!=this.oldParams[key] && key!='viewType'){
                      console.log("changed "+key);
                      needsUpdate=true;
                    }
                  }
                }
                else{
                  needsUpdate=true;
                }
                this.oldParams=params;
                if(params['viewType'])
                  this.viewType=params['viewType'];
                if(params['root'] && WorkspaceMainComponent.VALID_ROOTS.indexOf(params['root'])!=-1) {
                  this.root = params['root'];
                }
                if(params['reurl']) {
                  this.reurl = params['reurl'];
                }
                this.createAllowed=this.root=='MY_FILES';
                this.mainnav=params['mainnav']=='false' ? false : true;

                if(params['file']){
                  this.node.getNodeMetadata(params['file']).subscribe((data:NodeWrapper)=>{
                    this.setSelection([data.node])
                    this.metadataNode=params['file'];
                  });
                }

                if(!needsUpdate)
                  return;

                this.searchQuery='';
                if(params['query']) {
                  this.searchQuery=params['query'];
                  this.doSearchFromRoute(this.searchQuery);
                }
                else if(params['id']) {
                  this.openDirectoryFromRoute(params['id']);
                }
                else{
                  this.openDirectoryFromRoute("");
                }
                if(params['showAlpha']){
                  this.showAlpha();
                }
              });
            });
          });
        });
      });
    });
  }


  public doSearch(query:string){
    this.routeTo(this.root,null,query);
  }
  private doSearchFromRoute(query:string){
    this.searchQuery=query;
    this.createAllowed=false;
    this.path=[];
    this.selection=[];
    this.currentFolder=null;
    this.actionOptions = this.getOptions(null,false);

    if(this.root=='MY_SHARED_FILES' || this.root=='SHARED_FILES')
      this.root='MY_FILES';
    if(!this.searchQuery){
      this.openDirectory(null);
      return;
    }

  }
  private manageContributorsNode(node: Node) {
    let list=this.getNodeList(node);
    this.contributorNode=list[0];
  }
  private manageWorkflowNode(node: Node) {
    let list=this.getNodeList(node);
    this.workflowNode=list[0];
  }
  private setShareLinkNode(node: Node) {
    let list=this.getNodeList(node);
    this.shareLinkNode=list[0];
  }
  private shareNode(node: Node) {
    let list=this.getNodeList(node);
    this.sharedNode=list[0];
  }
  private editNode(node: Node) {
    let list=this.getNodeList(node);
    this.editNodeMetadata=list[0];
    this.editNodeAllowReplace=true;
  }
  private editLicense(node: Node) {
    let list=this.getNodeList(node);
    this.editNodeLicense=list;
  }
  private addFolder(folder : any){
    this.addFolderName=null;
    this.globalProgress=true;
    let properties=RestHelper.createNameProperty(folder.name);
    if(folder.metadataset) {
      properties[RestConstants.CM_PROP_METADATASET_EDU_METADATASET] = [folder.metadataset];
      properties[RestConstants.CM_PROP_METADATASET_EDU_FORCEMETADATASET] = ["true"];
    }
    this.node.createNode(this.currentFolder.ref.id,RestConstants.CM_TYPE_FOLDER,[],properties).subscribe(
      (data : NodeWrapper)=>{
        //this.openNode(data.node.ref.id,false);
        this.globalProgress=false;
        this.refresh();
        this.toast.toast("WORKSPACE.TOAST.FOLDER_ADDED");
      },
      (error : any)=>{
        this.globalProgress=false;
        if(NodeHelper.handleNodeError(this.toast,folder.name,error)==RestConstants.DUPLICATE_NODE_RESPONSE){
          this.addFolderName=folder.name;
        }
      }
    )
  }
  private uploadFiles(files : FileList){
    this.onFileDrop(files);
  }
  public onFileDrop(files : FileList){
    if(this.searchQuery){
      this.toast.error(null,"WORKSPACE.TOAST.NOT_POSSIBLE_IN_SEARCH");
      return;
    }
    if(!this.createAllowed){
      this.toast.error(null,"WORKSPACE.TOAST.NO_WRITE_PERMISSION");
      return;
    }
    this.showUploadSelect=false;
    this.filesToUpload=files;
  }
  private deleteConfirmed(nodes : Node[],position=0,error=false) : void{
    if(position>=nodes.length){
      this.globalProgress=false;
      this.metadataNode=null;
      this.refresh();
      if(!error)
        this.toast.toast("WORKSPACE.TOAST.DELETE_FINISHED");
      this.selection=[];
      return;
    }
    this.hideDialog();
    this.globalProgress=true;
    this.node.deleteNode(nodes[position].ref.id).subscribe(data => this.deleteConfirmed(nodes,position+1,error),
      (error:any)=>{
        this.toast.error(error);
        this.deleteConfirmed(nodes,position+1,true);
      });
  }
  private deleteNode(node: Node=null) {
    let list=this.getNodeList(node);
    if(list==null)
      return;
    this.dialogTitle="WORKSPACE.DELETE_TITLE"+(list.length==1 ? "_SINGLE" : "");
    this.dialogCancelable=true;
    this.dialogMessage="WORKSPACE.DELETE_MESSAGE"+(list.length==1 ? "_SINGLE" : "");
    this.dialogMessageParameters={name:list[0].name};
    this.dialogButtons=DialogButton.getOkCancel(() => this.hideDialog(),()=>this.deleteConfirmed(list));
  }

  private pasteNode(position=0){
    let clip=(this.storage.get("workspace_clipboard") as ClipboardObject);
    if(this.searchQuery || this.isRootFolder)
      return;
    if(!clip || !clip.nodes.length)
      return;
    if(clip.sourceNode && clip.sourceNode.ref.id==this.currentFolder.ref.id && !clip.copy){
      return;
    }
    if(position>=clip.nodes.length){
      this.globalProgress=false;
      this.storage.remove("workspace_clipboard");
      let info:any={
        from:clip.sourceNode ? clip.sourceNode.name : this.translate.instant('WORKSPACE.COPY_SEARCH'),
        to:this.currentFolder.name,
        count:clip.nodes.length,
        mode:this.translate.instant("WORKSPACE."+(clip.copy ? "PASTE_COPY" : "PASTE_MOVE"))
      }
      this.toast.toast("WORKSPACE.TOAST.PASTE",info);
      this.refresh();
      return;
    }
    this.globalProgress=true;
    let target=this.currentFolder.ref.id;
    console.log(this.currentFolder);
    let source=clip.nodes[position].ref.id;
    if(clip.copy)
      this.node.copyNode(target,source).subscribe(
        (data : NodeWrapper)=> this.pasteNode(position+1),
        (error : any)=> {
          NodeHelper.handleNodeError(this.toast,clip.nodes[position].name, error);
          this.globalProgress = false;
        });
    else
      this.node.moveNode(target,source).subscribe(
        (data : NodeWrapper)=> this.pasteNode(position+1),
        (error : any)=>{
          NodeHelper.handleNodeError(this.toast,clip.nodes[position].name,error);
          this.globalProgress=false;
        }
      );

  }
  private cutCopyNode(node: Node,copy:boolean) {
    let list=this.getNodeList(node);
    if(!list || !list.length)
      return;
    list=JSON.parse(JSON.stringify(list));
    let clip : ClipboardObject={sourceNode : this.currentFolder,nodes:list,copy:copy};
    this.storage.set("workspace_clipboard",clip);
    this.toast.toast("WORKSPACE.TOAST.CUT_COPY",{count:list.length});
  }
  private downloadNode(node: Node) {
    let list = this.getNodeList(node);
    NodeHelper.downloadNodes(this.connector,list);
  }
  private displayNode(event:Node){
    let list = this.getNodeList(event);
    this.closeMetadata();
    if(list[0].isDirectory){
      this.openDirectory(list[0].ref.id);
    }
    else {
      /*
      this.nodeDisplayed = event;
      this.nodeDisplayedVersion = event.version;
      */
      this.currentNode=list[0];
      this.storage.set(TemporaryStorageService.NODE_RENDER_PARAMETER_OPTIONS,this.nodeOptions);
      this.storage.set(TemporaryStorageService.NODE_RENDER_PARAMETER_LIST,this.currentNodes);
      this.router.navigate([UIConstants.ROUTER_PREFIX+"render", list[0].ref.id,list[0].version ? list[0].version : ""]);
    }
  }
  private restoreVersion(version : Version){
    this.dialogTitle="WORKSPACE.METADATA.RESTORE_TITLE";
    this.dialogCancelable=true;
    this.dialogMessage="WORKSPACE.METADATA.RESTORE_MESSAGE";
    this.dialogButtons=DialogButton.getYesNo(()=>this.hideDialog(),()=>this.doRestoreVersion(version));
  }
  // returns either the passed node as list, or the current selection if the passed node is invalid (actionbar)
  private getNodeList(node : Node) : Node[]{
    if(Array.isArray(node))
      return node;
    let nodes=[node];
    if(node==null)
      nodes=this.selection;
    return nodes;
  }

  private loadFolders(user: IamUser) {
    for(let folder of user.person.sharedFolders){
      this.node.getNodeMetadata(folder.id).subscribe((node : NodeWrapper) => this.sharedFolders.push(node.node));
    }
  }
  private setRoot(root : string){
    this.root=root;
    this.routeTo(root);
  }
  private updateList(nodes : Node[]){
    this.currentNodes=nodes;
  }

  private clickNode(node : Node){
    //if(!this.selection || this.selection.length<2)
    this.setSelection([node]);

    if(!node.isDirectory) {
      if(this.ui.isMobile())
        this.displayNode(node);
      else {
        if(this.metadataNode){
          this.openMetadata(node);
        }
      }
    }
    else {
      //this.closeMetadata();
      if(this.ui.isMobile())
        this.openDirectory(node.ref.id);
      else if(this.metadataNode)
        this.openMetadata(node)
    }
  }
  private openMetadata(node : Node|string) {
    let old=this.metadataNode;
    if(node==null)
      node=this.selection[0];
    if(typeof node=='string')
      this.metadataNode=new String((node as string));
    else
      this.metadataNode=new String((node as Node).ref.id);
    this.infoToggle.icon='info';
    if(old && this.metadataNode.toString()==old.toString()){
      this.closeMetadata();
    }
  }
  public updateOptions(node : Node) : void{
    this.explorerOptions=this.getOptions([node ? node : new Node()],true);
  }

  public closeWorkflow(){
    this.workflowNode=null;
    this.refresh();
  }
  public getOptions(nodes : Node[],fromList:boolean) : OptionItem[] {
    if(nodes && !nodes.length)
      nodes=null;
    let options: OptionItem[] = [];

    let allFiles=true;
    if(nodes) {
      for (let node of nodes) {
        if (node.isDirectory)
          allFiles = false;
      }
    }
    let clip=(this.storage.get("workspace_clipboard") as ClipboardObject);
    if(this.currentFolder && !nodes && !this.searchQuery && clip && ((!clip.sourceNode || clip.sourceNode.ref.id!=this.currentFolder.ref.id) || clip.copy) && this.createAllowed) {
      options.push(new OptionItem("WORKSPACE.OPTION.PASTE", "content_paste", (node: Node) => this.pasteNode()));
      console.log("add paste");
    }
    if (nodes && nodes.length == 1) {
      if(this.reurl && !nodes[0].isDirectory){
        let apply=new OptionItem("APPLY", "redo", (node: Node) => NodeHelper.addNodeToLms(this.router,this.storage,this.getNodeList(node)[0],this.reurl));
        apply.showAsAction=true;
        apply.enabledCallback=((node:Node)=> {
          return node.access.indexOf(RestConstants.ACCESS_CC_PUBLISH) != -1;
        });
        options.push(apply);
      }

      let open = new OptionItem("WORKSPACE.OPTION.SHOW", "remove_red_eye", (node: Node) => this.displayNode(node));
      if (!nodes[0].isDirectory)
        options.push(open);
    }
    let view = new OptionItem("WORKSPACE.OPTION.VIEW", "launch", (node: Node) => this.editConnector(node));
    if(fromList){
      view.showAlways = true;
      view.showCallback=((node:Node)=>{
        return RestConnectorsService.connectorSupportsEdit(this.connectorList, node) != null;
      });
      options.push(view);
    }
    else if(nodes && nodes.length==1 && RestConnectorsService.connectorSupportsEdit(this.connectorList,nodes[0])){
      options.push(view);
    }
    if(nodes && nodes.length==1){
      let edit=new OptionItem("WORKSPACE.OPTION.EDIT", "info_outline", (node: Node) => this.editNode(node));
      edit.isEnabled = NodeHelper.getNodesRight(nodes, RestConstants.ACCESS_WRITE);
      edit.isSeperateBottom = true;
      if(edit.isEnabled)
        options.push(edit);
    }
    if(nodes && nodes.length && allFiles) {
      let collection = new OptionItem("WORKSPACE.OPTION.COLLECTION", "layers", (node: Node) => this.addToCollection(node));
      collection.isEnabled = NodeHelper.getNodesRight(nodes, RestConstants.ACCESS_CC_PUBLISH);
      collection.showAsAction=true;
      if (!this.isSafe)
        options.push(collection);
    }
    let share:OptionItem;
    if (nodes && nodes.length == 1) {
      share = new OptionItem("WORKSPACE.OPTION.INVITE", "group_add", (node: Node) => this.shareNode(node));
      share.isSeperate = allFiles;
      share.showAsAction = true;
      share.isEnabled = NodeHelper.getNodesRight(nodes, RestConstants.ACCESS_CHANGE_PERMISSIONS) && (
        (this.connector.hasToolPermissionInstant(RestConstants.TOOLPERMISSION_INVITE) && !this.isSafe)
        || (this.connector.hasToolPermissionInstant(RestConstants.TOOLPERMISSION_INVITE_SAFE) && this.isSafe)
      );
      //if (this.isSafe && this.root!='SHARED_FILES')
      //  share.isEnabled=false;
      options.push(share);
      let shareLink = new OptionItem("WORKSPACE.OPTION.SHARE_LINK", "link", (node: Node) => this.setShareLinkNode(node));
      shareLink.isEnabled = NodeHelper.getNodesRight(nodes, RestConstants.ACCESS_WRITE) &&
          this.connector.hasToolPermissionInstant(RestConstants.TOOLPERMISSION_INVITE) &&
          this.connector.hasToolPermissionInstant(RestConstants.TOOLPERMISSION_INVITE_LINK);

      if (nodes && !nodes[0].isDirectory && !this.isSafe)
        options.push(shareLink);

    }
    if(nodes) {
      let license = new OptionItem("WORKSPACE.OPTION.LICENSE", "copyright", (node: Node) => this.editLicense(node));
      license.isEnabled = !this.isSafe && allFiles && NodeHelper.getNodesRight(nodes, RestConstants.ACCESS_WRITE) && this.connector.hasToolPermissionInstant(RestConstants.TOOLPERMISSION_LICENSE);
      if (license.isEnabled)
        options.push(license);
    }
    if (nodes && nodes.length == 1) {
      let contributor=new OptionItem("WORKSPACE.OPTION.CONTRIBUTOR","group",(node:Node)=>this.manageContributorsNode(node));
      contributor.isEnabled=NodeHelper.getNodesRight(nodes,RestConstants.ACCESS_WRITE);
      if(nodes && !nodes[0].isDirectory && !this.isSafe)
        options.push(contributor);
      let workflow=new OptionItem("WORKSPACE.OPTION.WORKFLOW","swap_calls",(node:Node)=>this.manageWorkflowNode(node));
      workflow.isEnabled=share.isEnabled;
      if(nodes && !nodes[0].isDirectory && this.supportsWorkflow())
        options.push(workflow);


      this.infoToggle=new OptionItem("WORKSPACE.OPTION.METADATA", "info_outline", (node: Node) => this.openMetadata(node));
      this.infoToggle.isToggle=true;
      //info.onlyMobile=!nodes[0].isDirectory;
      options.push(this.infoToggle);
      //options[0].showAlways = true;


    }
    if (nodes && nodes.length) {
      if(allFiles){
        let download=new OptionItem("WORKSPACE.OPTION.DOWNLOAD", "cloud_download", (node: Node) => this.downloadNode(node));
        download.enabledCallback=(node:Node)=>{
          return nodes && nodes[0].downloadUrl && nodes[0].properties && !nodes[0].properties[RestConstants.CCM_PROP_IO_WWWURL];
        }
        if(download.isEnabled)
          options.push(download);
      }

      let cut=new OptionItem("WORKSPACE.OPTION.CUT", "content_cut", (node: Node) => this.cutCopyNode(node, false));
      cut.isSeperate = true;
      options.push(cut);
      options.push(new OptionItem("WORKSPACE.OPTION.COPY", "content_copy", (node: Node) => this.cutCopyNode(node, true)));
      let del=new OptionItem("WORKSPACE.OPTION.DELETE","delete", (node : Node) => this.deleteNode(node));
      del.isEnabled=NodeHelper.getNodesRight(nodes,RestConstants.ACCESS_DELETE);
      del.isSeperate=true;
      options.push(del);

      let custom=this.config.instant("nodeOptions");
      NodeHelper.addCustomNodeOptions(this.toast,this.http,this.connector,custom, nodes, options,(load:boolean)=>this.globalProgress=load);
    }
    if(!fromList && this.root!='RECYCLE') {
      this.viewToggle = new OptionItem("", this.viewType==0 ? "view_module" : "list", (node: Node) => this.toggleView());
      this.viewToggle.isToggle = true;
      options.push(this.viewToggle);
    }
    return options;
  }
  public supportsWorkflow(){
    return this.connector.getApiVersion()>=RestConstants.API_VERSION_4_0;
  }
  private setSelection(nodes : Node[]) {
    this.selection=nodes;
    this.actionOptions=this.getOptions(nodes,false);
  }
  private updateLicense(){
    this.closeMetadata();
  }
  private closeMetadata() {
    this.metadataNode=null;
    this.infoToggle.icon='info_outline';
  }
  private openDirectory(id:string){
    this.routeTo(this.root, id ? id : null);
  }
  private openDirectoryFromRoute(id : string,createRoute = true){
    this.selection=[];
    this.closeMetadata();
    this.createAllowed = false;
    this.actionOptions = this.getOptions(null,false);
    let hasId=id;
    if(!id){
      this.path=[];
      id=this.getRootFolderId();
      if(this.root=='RECYCLE')
        return;
    }
    else{
      this.node.getNodeParents(id).subscribe((data : NodeList)=>{
        this.path = data.nodes.reverse();
      },(error:any)=>{
        this.path=[];
        this.globalProgress=false;
      });
    }

    this.searchQuery=null;
    this.currentFolder=null;
    let root=WorkspaceMainComponent.VALID_ROOTS_NODES.indexOf(id)!=-1;
    if(!root || id==RestConstants.USERHOME) {
      this.isRootFolder=false;
      console.log("open path: "+id);
      this.node.getNodeMetadata(id).subscribe((data: NodeWrapper) => {
        this.currentFolder = data.node;
        this.event.broadcastEvent(FrameEventsService.EVENT_NODE_FOLDER_OPENED, this.currentFolder);
        this.createAllowed = NodeHelper.getNodesRight([this.currentFolder], RestConstants.ACCESS_ADD_CHILDREN);
        this.actionOptions = this.getOptions(this.selection, false);
      }, (error: any) => {
        this.currentFolder = {ref: {id: id}};
        this.event.broadcastEvent(FrameEventsService.EVENT_NODE_FOLDER_OPENED, this.currentFolder);
        this.searchQuery = null;
      });
    }
    else{
        this.isRootFolder=true;
        console.log("open root path "+id);
      if(id==RestConstants.USERHOME){
        this.createAllowed = true;
      }
      this.currentFolder = {ref: {id: id}};
      this.event.broadcastEvent(FrameEventsService.EVENT_NODE_FOLDER_OPENED, this.currentFolder);
      this.searchQuery = null;
    }

  }
  private openNode(node : Node,useConnector=true) {
    if(!node.isDirectory){
      if(RestToolService.isLtiObject(node)){
        this.toolService.openLtiObject(node);
      }
      else if(useConnector && RestConnectorsService.connectorSupportsEdit(this.connectorList,node)){
        this.editConnector(node);
      }
      else {
        this.displayNode(node);
      }
      return;
    }
    this.openDirectory(node.ref.id);
  }
  private openBreadcrumb(position : number){
    /*this.path=this.path.slice(0,position+1);
    */
    this.searchQuery=null;
    this.actionOptions=null;
    let id="";
    if(position>0)
      id=this.path[position-1].ref.id;
    else {
      this.showSelectRoot = true;
      return;
    }
    console.log("breadcrumb "+position+" "+id);

    this.openDirectory(id);
  }

  private refresh() {
    let search=this.searchQuery;
    let folder=this.currentFolder;
    this.currentFolder=null;
    this.searchQuery=null;
    //this.currentFolder=JSON.parse(JSON.stringify(this.currentFolder));
    this.selection=[];
    this.actionOptions=this.getOptions(this.selection,false);
    let path=this.path;
    this.path=[null];
    console.log(this.path);
    setTimeout(()=>{
      this.path=path;
      this.currentFolder=folder;
      this.searchQuery=search;
    },10);
  }

  private doRestoreVersion(version: Version) : void {
    this.hideDialog();
    this.globalProgress=true;
    this.node.revertNodeToVersion(version.version.node.id,version.version.major,version.version.minor).subscribe((data : NodeVersions)=>{
        this.globalProgress=false;
        this.refresh();
        this.closeMetadata();
        this.openMetadata(version.version.node.id);
        this.toast.toast("WORKSPACE.REVERTED_VERSION");
      },
      (error:any) => this.toast.error(error));
  }

  private refreshRoute(){
    console.log(this.isRootFolder);
    this.routeTo(this.root,!this.isRootFolder && this.currentFolder ? this.currentFolder.ref.id : null,this.searchQuery);
  }
  private routeTo(root: string,node : string=null,search="") {
    console.log("update route "+root+" "+node);
    let params:any={root:root,id:node?node:"",viewType:this.viewType,query:search,mainnav:this.mainnav};
    if(this.reurl)
      params.reurl=this.reurl;
    this.router.navigate(["./"],{queryParams:params,relativeTo:this.route});
  }

  private showAlpha() {
    this.dialogTitle='WORKSPACE.ALPHA_TITLE';
    this.dialogMessage='WORKSPACE.ALPHA_MESSAGE';
    this.dialogButtons=DialogButton.getOk(()=>{
      this.dialogTitle=null;
    });
  }

  private addToCollection(node: Node) {
    let nodes=this.getNodeList(node);
    this.addNodesToCollection=nodes;
  }
  private createContext(event:any=null){
    if(!this.createAllowed)
      return;
    this.showAddDesktop = true;
    this.dropdownPosition = null;
    this.dropdownTop = null;
    this.dropdownBottom = null;
    this.dropdownLeft = null;
    this.dropdownRight = null;
    if(event) {
      event.preventDefault();
      event.stopPropagation();
      this.dropdownPosition = "fixed";
      this.dropdownLeft = event.clientX + "px";
      if (event.clientY > window.innerHeight / 2) {
        this.dropdownBottom = window.innerHeight - event.clientY + "px";
        this.dropdownTop = "auto";
      }
      else {
        this.dropdownTop = event.clientY + "px";
      }
    }
  }
  private createMobile(){
    if(!this.createAllowed)
      return;
    this.showAddDesktop = true;
    this.dropdownPosition = "fixed";
    this.dropdownTop = "auto";
    this.dropdownLeft = "auto";
    this.dropdownBottom = "30px";
    this.dropdownRight = "70px";
  }
  private addToCollectionList(collection:Node[],nodes=this.addNodesToCollection,position=0,error=false){
    if(position>=nodes.length){
      if(!error)
        this.toast.toast("WORKSPACE.TOAST.ADDED_TO_COLLECTION",{count:nodes.length,collection:collection[0].title});
      this.globalProgress=false;
      return;
    }
    this.addNodesToCollection=null;
    this.globalProgress=true;
    this.collectionApi.addNodeToCollection(collection[0].ref.id,nodes[position].ref.id).subscribe(()=>{
        this.addToCollectionList(collection,nodes,position+1,error);
      },
      (error:any)=>{
        if(error.status==RestConstants.DUPLICATE_NODE_RESPONSE){
          this.toast.error(null,"WORKSPACE.TOAST.NODE_EXISTS_IN_COLLECTION",{name:nodes[position].name});
        }
        else
          NodeHelper.handleNodeError(this.toast,nodes[position].name,error);
        this.addToCollectionList(collection,nodes,position+1,true);
      });
  }

  private goToLogin() {
    UIHelper.goToLogin(this.router,this.config,this.isSafe ? RestConstants.SAFE_SCOPE : "");
  }

  private getRootFolderId() {
    if(this.root=='MY_FILES')
      return RestConstants.USERHOME;
    if(this.root=='SHARED_FILES'){
      return RestConstants.SHARED_FILES;
    }
    if(this.root=='MY_SHARED_FILES'){
      return RestConstants.MY_SHARED_FILES;
    }
    if(this.root=='TO_ME_SHARED_FILES'){
      return RestConstants.TO_ME_SHARED_FILES;
    }
    if(this.root=='WORKFLOW_RECEIVE'){
      return RestConstants.WORKFLOW_RECEIVE;
    }
    return "";
  }

  private toggleView() {
    this.viewType=1-this.viewType;
    this.refreshRoute();
    /*
    if(this.viewType==0){
      this.viewToggle.icon='view_module';
    }
    else{
      this.viewToggle.icon='list';
    }
    */
  }

  public listLTI() {
    this.showLtiTools=true;
    this.showAddDesktop=false;
    this.showAddMobile=false;
  }
}
interface ClipboardObject{
  nodes : Node[];
  sourceNode : Node;
  copy : boolean;
}
