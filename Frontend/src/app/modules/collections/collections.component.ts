import {Component, ElementRef, OnInit, ViewChild} from '@angular/core';

import {Router, Params, ActivatedRoute} from "@angular/router";
import {RouterComponent} from "../../router/router.component";

import {Translation} from "../../common/translation";

import * as EduData from "../../common/rest/data-object";

import {RestCollectionService} from "../../common/rest/services/rest-collection.service";
import {RestNodeService} from "../../common/rest/services/rest-node.service";
import {RestIamService} from "../../common/rest/services/rest-iam.service";
import {RestHelper} from "../../common/rest/rest-helper";
import {RestConstants} from "../../common/rest/rest-constants";

import {Toast} from "../../common/ui/toast";
import {RestConnectorService} from "../../common/rest/services/rest-connector.service";
import {
    Collection,
    NodeRef,
    CollectionReference,
    LoginResult,
    MdsMetadataset,
    CollectionFeedback
} from "../../common/rest/data-object";
import {RestOrganizationService} from "../../common/rest/services/rest-organization.service";
import {OrganizationOrganizations} from "../../common/rest/data-object";
import {OptionItem} from "../../common/ui/actionbar/option-item";
import {TemporaryStorageService} from "../../common/services/temporary-storage.service";
import {NodeRenderComponent} from "../../common/ui/node-render/node-render.component";
import {DialogButton} from "../../common/ui/modal-dialog/modal-dialog.component";
import {NodeWrapper,Node} from "../../common/rest/data-object";
import {FrameEventsService} from "../../common/services/frame-events.service";
import {UIHelper} from "../../common/ui/ui-helper";
import {Title} from "@angular/platform-browser";
import {ConfigurationService} from "../../common/services/configuration.service";
import {SessionStorageService} from "../../common/services/session-storage.service";
import {UIConstants} from "../../common/ui/ui-constants";
import {ListItem} from "../../common/ui/list-item";
import {AddElement, ListTableComponent} from "../../common/ui/list-table/list-table.component";
import {RestMdsService} from "../../common/rest/services/rest-mds.service";
import {NodeHelper, NodesRightMode} from "../../common/ui/node-helper";
import {TranslateService} from "@ngx-translate/core";
import {MdsHelper} from "../../common/rest/mds-helper";
import {UIAnimation} from "../../common/ui/ui-animation";
import {trigger} from "@angular/animations";
import {Location} from "@angular/common";
import {Helper} from "../../common/helper";
import {UIService} from "../../common/services/ui.service";
import {MainNavComponent} from "../../common/ui/main-nav/main-nav.component";
import {ColorHelper} from '../../common/ui/color-helper';
import {ActionbarHelperService} from "../../common/services/actionbar-helper";
import {RestLocatorService} from '../../common/rest/services/rest-locator.service';
import {HttpClient} from "@angular/common/http";
import {GlobalContainerComponent} from "../../common/ui/global-container/global-container.component";

// component class
@Component({
  selector: 'app-collections',
  templateUrl: 'collections.component.html',
  styleUrls: ['collections.component.scss'],
  animations: [
      trigger('fade', UIAnimation.fade()),
      trigger('cardAnimation', UIAnimation.cardAnimation())
  ]
})
export class CollectionsMainComponent {
  @ViewChild('mainNav') mainNavRef: MainNavComponent;
  @ViewChild('listCollections') listCollections :  ListTableComponent;

  public dialogTitle : string;
  public globalProgress=false;
  public dialogCancelable = false;
  public dialogMessage : string;
  public dialogButtons : DialogButton[];

    public tabSelected:string = RestConstants.COLLECTIONSCOPE_MY;
    public isLoading:boolean = true;
    public isReady:boolean = false;

  public collectionContent:any;
  private collectionContentOriginal: any;
  private filteredOutCollections:Array<EduData.Collection> = new Array<EduData.Collection>();
  private filteredOutReferences:Array<EduData.CollectionReference> = new Array<EduData.CollectionReference>();
  public lastError:string = null;

  private contentDetailObject:any = null;

  // real parentCollectionId is only available, if user was browsing
  private parentCollectionId:EduData.Reference = new EduData.Reference(RestConstants.HOME_REPOSITORY,RestConstants.ROOT);

  private temp:string;
  private lastScrollY:number;

    private person : EduData.User;
    public mainnav = true;
    private path : EduData.Node[];
    private hasEditorial = false;
    public isGuest = true;
    public addToOther:EduData.Node[];
    private showCollection=true;
    private pinningAllowed = false;
    public addPinning: string;
    public infoTitle: string;
    public infoMessage: string;
    public infoButtons: DialogButton[];
    public infoClose: Function;
    public nodeReport: Node;
    public collectionsColumns : ListItem[]=[];
    public referencesColumns : ListItem[]=[];
    public createCollectionElement = new AddElement("COLLECTIONS.CREATE_COLLECTION");
    public createCollectionReference = new AddElement("COLLECTIONS.ADD_MATERIAL","redo");
    private listOptions: OptionItem[];
    private _orderActive: boolean;
    optionsMaterials:OptionItem[];
    tutorialElement: ElementRef;
    private reurl: any;
    optionsCollection:OptionItem[] = [];
    private _collectionShare: Collection;
    private static PROPERTY_FILTER=[RestConstants.CCM_PROP_LIFECYCLECONTRIBUTER_AUTHOR];
    private static DEFAULT_REQUEST={sortBy: [
            RestConstants.CCM_PROP_COLLECTION_PINNED_STATUS,
            RestConstants.CCM_PROP_COLLECTION_PINNED_ORDER,
            RestConstants.CM_MODIFIED_DATE
            ],
        sortAscending: [false,true,false],
    };
    feedback: boolean;
    feedbackView: boolean;
    private feedbacks: CollectionFeedback[];
    private params: Params;
    set collectionShare(collectionShare: Collection){
        this._collectionShare=collectionShare;
        this.refreshAll();
    }
    get collectionShare(){
        return this._collectionShare;
    }
  // default hides the tabs

    // inject services
    constructor(
      private frame : FrameEventsService,
      private http : HttpClient,
      private temporaryStorageService : TemporaryStorageService,
        private location : Location,
        private collectionService : RestCollectionService,
        private nodeService : RestNodeService,
        private organizationService : RestOrganizationService,
        private iamService : RestIamService,
        private mdsService : RestMdsService,
      private actionbar : ActionbarHelperService,
      private storage : SessionStorageService,
      private connector : RestConnectorService,
        private route:ActivatedRoute,
        private uiService:UIService,
        private router : Router,
        private tempStorage :TemporaryStorageService,
        private toast : Toast,
      private title:Title,
      private config:ConfigurationService,
        private translationService: TranslateService) {
            this.collectionsColumns.push(new ListItem("COLLECTION", 'title'));
            this.collectionsColumns.push(new ListItem("COLLECTION", 'info'));
            this.collectionsColumns.push(new ListItem("COLLECTION",'scope'));
            this.setCollectionId(RestConstants.ROOT);
            Translation.initialize(this.translationService,this.config,this.storage,this.route).subscribe(()=>{
              UIHelper.setTitle('COLLECTIONS.TITLE',title,translationService,config);
              this.mdsService.getSet().subscribe((data:MdsMetadataset)=>{
                this.referencesColumns=MdsHelper.getColumns(data,'collectionReferences');
              });

                this.connector.isLoggedIn().subscribe((data:LoginResult)=>{
                    if(data.isValidLogin && data.currentScope==null) {
                        this.pinningAllowed=this.connector.hasToolPermissionInstant(RestConstants.TOOLPERMISSION_COLLECTION_PINNING);
                        this.isGuest=data.isGuest;
                        this.collectionService.getCollectionSubcollections(RestConstants.ROOT,RestConstants.COLLECTIONSCOPE_TYPE_EDITORIAL).subscribe((data)=>{
                            this.hasEditorial=data.collections.length>0;
                        });
                        this.initialize();
                    }else
                        RestHelper.goToLogin(this.router,this.config);
                },(error:any)=> RestHelper.goToLogin(this.router,this.config));

            });
    }
    public isMobile(){
      return this.uiService.isMobile();
    }
    public isMobileWidth(){
        return window.innerWidth<UIConstants.MOBILE_WIDTH;
    }
  public setCustomOrder(event:any){
    let checked=event.target.checked;
    this.collectionContent.collection.orderMode=checked ? RestConstants.COLLECTION_ORDER_MODE_CUSTOM : null;
    if(checked){
      this.orderActive=true;
    }
    else{
      this.globalProgress = true;
      this.collectionService.setOrder(this.collectionContent.collection.ref.id).subscribe(()=>{
        this.globalProgress = false;
        this.orderActive=false;
        //this.refreshContent(()=>this.globalProgress=false);
      });
    }

    }

    public set orderActive(orderActive:boolean){
      this._orderActive=orderActive;
      this.collectionContent.collection.orderMode=orderActive ? RestConstants.COLLECTION_ORDER_MODE_CUSTOM : null;

    if(this._orderActive){
      this.infoTitle='COLLECTIONS.ORDER_ELEMENTS';
      this.infoMessage='COLLECTIONS.ORDER_ELEMENTS_INFO';
      this.infoButtons=DialogButton.getSingleButton("SAVE",()=>{
        this.changeOrder();
      });
      this.infoClose=()=>{
        this.orderActive=false;
      }
      this.loadMoreReferences(true);
    }
    else{
      this.infoTitle=null;
      //this.collectionContent.references=Helper.deepCopy(this.collectionContentOriginal.references);
      this.refreshAll();
    }
  }
  public get orderActive(){
    return this._orderActive;
  }
  navigate(id = '',addToOther = '',feedback = false){
    let params:any={};
    UIHelper.getCommonParameters(this.route).subscribe((params)=>{
        params.scope=this.tabSelected;
        params.id=id;
        if(feedback) {
            params.feedback = feedback;
        }
        if(addToOther) {
            params.addToOther = addToOther;
        }
        this.router.navigate([UIConstants.ROUTER_PREFIX+"collections"],{queryParams:params});
    });
  }
  closeAddToOther(){
    this.navigate(this.collectionContent.collection.ref.id);
  }
  selectTab(tab:string){
    if ((this.tabSelected!=tab)
      || (this.getCollectionId()!=RestConstants.ROOT)) {

      this.tabSelected = tab;
      this.setCollectionId(RestConstants.ROOT);
      this.parentCollectionId = new EduData.Reference(RestConstants.HOME_REPOSITORY, RestConstants.ROOT);
      this.contentDetailObject = null;
      this.navigate();
    }
  }
  selectTabMyCollections():void {
    this.selectTab(RestConstants.COLLECTIONSCOPE_MY);

  }

  selectTabMyOrganizations():void {
    this.selectTab(RestConstants.COLLECTIONSCOPE_ORGA);

  }

  selectTabAllCollections():void {
    this.selectTab(RestConstants.COLLECTIONSCOPE_ALL);
  }


  // sorting collections and references
  /*
  sortCollectionContent() : void {
      this.collectionContent.collections = this.collectionContent.collections.sort(
          function(a:EduData.Collection,b:EduData.Collection):number {
              // first sort by number of sub collections
              if (a.childCollectionsCount!=b.childCollectionsCount) return  b.childCollectionsCount-a.childCollectionsCount;
              // second sort by number of references
              if (a.childReferencesCount!=b.childReferencesCount) return  b.childReferencesCount-a.childReferencesCount;
              // third sort by date of creation
              return 0;
          }
      );
  }
  */

  // just show content (collections & references) that
  // match the keyword in title ot description
  /*
    filterCollectionContent(keyword:string):void {

       // put back all previous filtered out

       this.collectionContent.references = this.collectionContent.references.concat(this.filteredOutReferences);
       this.collectionContent.collections = this.collectionContent.collections.concat(this.filteredOutCollections);
       this.filteredOutReferences = new Array<EduData.CollectionReference>();
       this.filteredOutCollections = new Array<EduData.Collection>();

       // filter collections
       var filteredInCollections:Array<EduData.Collection> = new Array<EduData.Collection>();
       this.collectionContent.collections.forEach((collection) => {
           var isMatch:boolean = false;
           if ((typeof collection.title != "undefined") && (collection.title.toLowerCase().indexOf(keyword.toLowerCase())>=0)) isMatch = true;
           if ((typeof collection.description != "undefined") && (collection.description.toLowerCase().indexOf(keyword.toLowerCase())>=0)) isMatch = true;
           if (isMatch) {
               filteredInCollections.push(collection);
           } else {
               this.filteredOutCollections.push(collection);
           }
       });
       this.collectionContent.collections = filteredInCollections;

       // filter references
       var filteredInReferences:Array<EduData.CollectionReference> = new Array<EduData.CollectionReference>();
       this.collectionContent.references.forEach((reference) => {
           var isMatch:boolean = false;
           if ((typeof reference.reference.title != "undefined") && (reference.reference.title.toLowerCase().indexOf(keyword.toLowerCase())>=0)) isMatch = true;
           if ((typeof reference.reference.description != "undefined") && (reference.reference.description.toLowerCase().indexOf(keyword.toLowerCase())>=0)) isMatch = true;
           if (isMatch) {
               filteredInReferences.push(reference);
           } else {
               this.filteredOutReferences.push(reference);
           }
       });
       this.collectionContent.references = filteredInReferences;

       this.sortCollectionContent();
    }
    */
    isRootLevelCollection():boolean {
        return !this.showCollection;
        /*
        if (this.collectionContent==null) return false;
        return this.collectionContent.getCollectionID()=='-root-';
        */
    }

  isAllowedToEditCollection() : boolean {
    // This seems to be wrong: He may has created a public collection and wants to edit it
    if ((this.isRootLevelCollection()) && (this.tabSelected!=RestConstants.COLLECTIONSCOPE_MY)) return false;

    if (RestHelper.hasAccessPermission(this.collectionContent.collection,RestConstants.PERMISSION_DELETE)) return true;
    return false;
  }
    feedbackAllowed() : boolean {
       return !this.isGuest && RestHelper.hasAccessPermission(this.collectionContent.collection,RestConstants.PERMISSION_FEEDBACK);
    }
  isAllowedToDeleteCollection() : boolean {
    if (this.isRootLevelCollection()) return false;
    if (RestHelper.hasAccessPermission(this.collectionContent.collection,RestConstants.PERMISSION_DELETE)) return true;
    return false;
  }

  isUserAllowedToEdit(collection:EduData.Collection) : boolean {
    return RestHelper.isUserAllowedToEdit(collection, this.person);
  }
  pinCollection(){
    this.addPinning=this.collectionContent.collection.ref.id;
  }

  getPrivacyScope(collection:EduData.Collection) : string {
    return collection.scope;
    //  return RestHelper.getPrivacyScope(collection);
  }

    navigateToSearch(){
        UIHelper.getCommonParameters(this.route).subscribe((params)=> {
            this.router.navigate([UIConstants.ROUTER_PREFIX + "search"], {queryParams: params});
        });
    }
    switchToSearch() : void {
       UIHelper.getCommonParameters(this.route).subscribe((params)=>{
          params.addToCollection=this.collectionContent.collection.ref.id;
          this.router.navigate([UIConstants.ROUTER_PREFIX+"search"],{queryParams:params});
       });
    }
    public isBrightColor(){
        return ColorHelper.getColorBrightness(this.collectionContent.collection.color)>ColorHelper.BRIGHTNESS_THRESHOLD_COLLECTIONS;
    }
    getScopeInfo(){
      return NodeHelper.getCollectionScopeInfo(this.collectionContent.collection);
    }
    public onSelection(nodes:EduData.Node[]){
        this.optionsMaterials=this.getOptions(nodes,false);
    }

    getOptions(nodes:Node[]=null,fromList:boolean) {
        let originalDeleted=nodes && nodes.filter((node:any)=>node.originalId==null).length>0;
        if(this.reurl){
            // no action bar in apply mode
            if(!fromList){
                return [];
            }
            let apply=new OptionItem("APPLY", "redo", (node: Node) => NodeHelper.addNodeToLms(this.router,this.tempStorage,ActionbarHelperService.getNodes(nodes,node)[0],this.reurl));
            apply.enabledCallback=((node:CollectionReference)=> {
                return node.originalId!=null && NodeHelper.getNodesRight(ActionbarHelperService.getNodes(nodes,node as any),RestConstants.ACCESS_CC_PUBLISH,NodesRightMode.Original);
            });
            return [apply];
        }

        let options: OptionItem[] = [];
        if (!fromList) {
            if (nodes && nodes.length) {
                if (!originalDeleted && NodeHelper.getNodesRight(nodes, RestConstants.ACCESS_CC_PUBLISH,NodesRightMode.Original)) {
                    let collection = this.actionbar.createOptionIfPossible('ADD_TO_COLLECTION', nodes, (node: Node) => this.addToOther = ActionbarHelperService.getNodes(nodes, node));
                    if (collection) {
                        collection.name='WORKSPACE.OPTION.COLLECTION_OTHER';
                        options.push(collection);
                    }
                }
                if (this.isAllowedToDeleteNodes(nodes)) {
                    let remove = new OptionItem('COLLECTIONS.DETAIL.REMOVE', 'remove_circle_outline', (node: Node) => {
                        this.deleteMultiple(ActionbarHelperService.getNodes(nodes, node));
                    });
                    if (remove)
                        options.push(remove);
                }
            }
        }
        if (fromList) {
            let collection = this.actionbar.createOptionIfPossible('ADD_TO_COLLECTION', nodes, (node: Node) => this.addToOtherCollection(node));
            if (collection) {
                collection.name='WORKSPACE.OPTION.COLLECTION_OTHER';
                options.push(collection);
            }
        }
      if (!originalDeleted && fromList || nodes && nodes.length) {
          let download = this.actionbar.createOptionIfPossible('DOWNLOAD', nodes, (node: Node) => NodeHelper.downloadNodes(this.toast, this.connector, ActionbarHelperService.getNodes(nodes, node)));
          options.push(download);
          let nodeStore = this.actionbar.createOptionIfPossible('ADD_NODE_STORE',nodes,(node: Node) => {
              this.addToStore(ActionbarHelperService.getNodes(nodes,node));
          });
          options.push(nodeStore);
      }
      if(fromList) {
          let remove = new OptionItem("COLLECTIONS.DETAIL.REMOVE", "remove_circle_outline", (node: Node) => this.deleteReference(ActionbarHelperService.getNodes(nodes, node)[0]));
          remove.showCallback = (node: Node) => {
              return this.isAllowedToDeleteNodes(ActionbarHelperService.getNodes(nodes, node));
          };
          options.push(remove);
      }
      if(fromList || nodes && nodes.length==1) {
          if (this.config.instant("nodeReport", false)) {
              let report = new OptionItem("NODE_REPORT.OPTION", "flag", (node: Node) => this.nodeReport = ActionbarHelperService.getNodes(nodes, node)[0]);
              options.push(report);
          }
      }

      let custom=this.config.instant('collectionNodeOptions');
      NodeHelper.applyCustomNodeOptions(this.toast,this.http,this.connector,custom,(this.collectionContent.references as any), nodes, options,(load:boolean)=>this.isLoading=load);

        return options;
    }
    dropOnCollection(event:any){
      let target=event.target;
      let source=event.source[0];
      this.globalProgress=true;
      console.log(source);
      if(source.hasOwnProperty('childCollectionsCount')){
        if(event.type=='copy'){
          this.toast.error(null,'INVALID_OPERATION');
          this.globalProgress=false;
          return;
        }
        this.nodeService.moveNode(target.ref.id,source.ref.id).subscribe(()=>{
          this.globalProgress = false;
          this.refreshContent();
        },(error)=>{
          this.handleError(error);
          this.globalProgress = false;
        });
      }
      else {
        this.collectionService.addNodeToCollection(target.ref.id, source.ref.id).subscribe(() => {
          UIHelper.showAddedToCollectionToast(this.toast,this.router, target, 1);
          if (event.type == 'copy') {
            this.globalProgress = false;
            this.refreshContent();
            return;
          }
          this.collectionService.removeFromCollection(source.ref.id, this.collectionContent.collection.ref.id).subscribe(() => {
            this.globalProgress = false;
            this.refreshContent();
          }, (error: any) => {
            this.handleError(error);
            this.globalProgress = false;
          });
        }, (error: any) => {
            this.handleError(error);
            this.globalProgress = false;
        });
      }
    }
    canDropOnCollection = (event:any)=>{
      if(event.source[0].ref.id==event.target.ref.id)
        return false;
      if(event.target.ref.id==this.collectionContent.collection.ref.id)
        return false;
      // in case it's via breadcrums, unmarshall the collection item
      if(event.target.collection)
          event.target=event.target.collection;
      console.log(event.source,event.target);
      // do not allow to move anything else than editorial collections into editorial collections (if the source is a collection)
      if(event.source[0].hasOwnProperty('childCollectionsCount')) {
          if (event.source[0].type == RestConstants.COLLECTIONTYPE_EDITORIAL && event.target.type != RestConstants.COLLECTIONTYPE_EDITORIAL
              || event.source[0].type != RestConstants.COLLECTIONTYPE_EDITORIAL && event.target.type == RestConstants.COLLECTIONTYPE_EDITORIAL)
              return false;
      }

      if(event.source[0].reference && !NodeHelper.getNodesRight(event.source[0], RestConstants.ACCESS_CC_PUBLISH,NodesRightMode.Original))
        return false;

      if(!NodeHelper.getNodesRight(event.target, RestConstants.ACCESS_WRITE,NodesRightMode.Local))
        return false;

    return true;
  }
  canDropOnRef(){
    // do not allow to drop here
    return false;
  }

  collectionDelete() : void {
    this.dialogTitle="COLLECTIONS.CONFIRM_DELETE";
    this.dialogMessage="COLLECTIONS.CONFIRM_DELETE_INFO";
    this.dialogCancelable=true;
    this.dialogButtons=DialogButton.getYesNo(()=>this.closeDialog(),()=>{
      this.isLoading = true;
      this.closeDialog();
      this.collectionService.deleteCollection(this.collectionContent.collection.ref.id, this.collectionContent.collection.ref.repo).subscribe( result => {
        this.isLoading = false;
        this.navigate(this.parentCollectionId.id);
      }, error => {
        this.isLoading = false;
        this.toast.error(null,'COLLECTIONS.ERROR_DELETE');
      });

    })
  }

    collectionEdit() : void {
        if (this.isAllowedToEditCollection()){
            this.router.navigate([UIConstants.ROUTER_PREFIX+'collections/collection','edit',this.collectionContent.collection.ref.id],{queryParams:{mainnav:this.mainnav}});
            return;
        }
    }

    // gets called by user if something went wrong to start fresh from beginning
    resetCollections() : void {
        let url = window.location.href;
        url = url.substring(0,url.indexOf("collections")+11);
        window.location.href = url;
        return;
    }

    refreshContent(callback:Function=null) : void {
        if (!this.isReady) return;
        this.onSelection([]);
        this.isLoading=true;
        GlobalContainerComponent.finishPreloading();

    // set correct scope
    let request:any=Helper.deepCopy(CollectionsMainComponent.DEFAULT_REQUEST);
    // when loading child collections, we load all of them
    if(!this.isRootLevelCollection()){
        request.count=RestConstants.COUNT_UNLIMITED;
    }
    this.collectionService.getCollectionSubcollections(this.collectionContent.collection.ref.id,
      this.getScope(),[],request,this.collectionContent.collection.ref.repo
    ).subscribe((collection) => {
        console.log(collection);
        this.lastError = null;
        // transfere sub collections and content
        this.collectionContent.collections = collection.collections;
        this.collectionContent.collectionsPagination = collection.pagination;
        if(this.isRootLevelCollection()){
            this.finishCollectionLoading(callback);
            return;
        }
        request.count=null;
        this.collectionService.getCollectionReferences(this.collectionContent.collection.ref.id,
            CollectionsMainComponent.PROPERTY_FILTER,request,this.collectionContent.collection.ref.repo).subscribe((refs)=>{
            this.collectionContent.references=refs.references;
            this.collectionContent.referencesPagination=refs.pagination;
            this.finishCollectionLoading(callback);
        })

    },(error:any)=>{
        this.toast.error(error);
    });


    if ((this.getCollectionId()!=RestConstants.ROOT) && (this.collectionContent.collection.permission==null)) {
        this.nodeService.getNodePermissions(this.getCollectionId()).subscribe( permission => {
            this.collectionContent.collection.permission = permission.permissions;
        });
    }
  }
  loadMoreReferences(loadAll=false){
      if(this.collectionContent.references.length==this.collectionContent.referencesPagination.total)
          return;
      if(this.collectionContent.referencesLoading)
          return;
      let request:any=Helper.deepCopy(CollectionsMainComponent.DEFAULT_REQUEST);
      request.offset=this.collectionContent.references.length;
      if(loadAll){
          request.count=RestConstants.COUNT_UNLIMITED;
      }
      this.collectionContent.referencesLoading=true;
      this.collectionService.getCollectionReferences(this.collectionContent.collection.ref.id,
          CollectionsMainComponent.PROPERTY_FILTER,request,this.collectionContent.collection.ref.repo).subscribe((refs)=> {
            this.collectionContent.references=this.collectionContent.references.concat(refs.references);
          this.collectionContent.referencesLoading=false;
      });
  }
    loadMoreCollections(){
        if(this.collectionContent.collections.length==this.collectionContent.collectionsPagination.total)
            return;
        if(this.collectionContent.collectionsLoading)
            return;
        let request:any=Helper.deepCopy(CollectionsMainComponent.DEFAULT_REQUEST);
        request.offset=this.collectionContent.collections.length;
        console.log(request);
        this.collectionContent.collectionsLoading=true;
        this.collectionService.getCollectionSubcollections(this.collectionContent.collection.ref.id,this.getScope(),[],request,this.collectionContent.collection.ref.repo).subscribe((refs)=> {
            this.collectionContent.collections=this.collectionContent.collections.concat(refs.collections);
            this.collectionContent.collectionsLoading=false;
        });
    }
    getScope(){
        return this.tabSelected ? this.tabSelected : RestConstants.COLLECTIONSCOPE_ALL;
    }
    onCreateCollection(){
      UIHelper.getCommonParameters(this.route).subscribe((params)=>{
          this.router.navigate([UIConstants.ROUTER_PREFIX+"collections/collection", "new", this.collectionContent.collection.ref.id],{queryParams:params});
      });
    }
    onCollectionsClick(collection:EduData.Collection) : void {

        // remember actual collection as breadcrumb
        if (!this.isRootLevelCollection()) {
            this.parentCollectionId = this.collectionContent.collection.ref;
        }

    // set thru router so that browser back button can work
    this.navigate(collection.ref.id);

    }
    deleteReference(content:EduData.CollectionReference|EduData.Node){
      this.contentDetailObject=content;
      this.deleteFromCollection();
    }
    canDelete(node:EduData.CollectionReference){
      return RestHelper.hasAccessPermission(node,'Delete');
    }
    onContentClick(content:any,force=false) : void {
      this.contentDetailObject=content;
      if (content.originalId==null && !force) {
        this.dialogTitle="COLLECTIONS.ORIGINAL_MISSING";
        this.dialogMessage="COLLECTIONS.ORIGINAL_MISSING_INFO";
        this.dialogCancelable=true;
        this.dialogButtons=[];
        if (this.isAllowedToDeleteNodes([content])) {
          this.dialogButtons.push(new DialogButton('COLLECTIONS.DETAIL.REMOVE',DialogButton.TYPE_CANCEL,()=>this.deleteFromCollection(()=>this.closeDialog())));
        }
        this.dialogButtons.push(new DialogButton('COLLECTIONS.OPEN_MISSING',DialogButton.TYPE_PRIMARY,()=>this.onContentClick(content,true)));
        return;
      }
      this.nodeService.getNodeMetadata(content.ref.id).subscribe((data:NodeWrapper)=>{
        this.contentDetailObject=data.node;

        // remember the scroll Y before displaying content
        this.lastScrollY = window.scrollY;
        let nodeOptions=[];
        /*if(data.node.downloadUrl)
          nodeOptions.push(new OptionItem("DOWNLOAD", "cloud_download", () => this.downloadMaterial()));
         */
        if(this.isAllowedToDeleteNodes([content])) {
          nodeOptions.push(new OptionItem("COLLECTIONS.DETAIL.REMOVE", "remove_circle_outline", () => this.deleteFromCollection(() => {
            NodeRenderComponent.close(this.location);
          })));
        }
        // set content for being displayed in detail
        this.temporaryStorageService.set(TemporaryStorageService.NODE_RENDER_PARAMETER_OPTIONS,nodeOptions);
        this.temporaryStorageService.set(TemporaryStorageService.NODE_RENDER_PARAMETER_LIST,this.collectionContent.references);
        this.temporaryStorageService.set(TemporaryStorageService.NODE_RENDER_PARAMETER_ORIGIN,"collections");
          this.router.navigate([UIConstants.ROUTER_PREFIX+"render",  content.ref.id]);
        //this.navigate(this.collectionContent.collection.ref.id,content.ref.id);
        // add breadcrumb


    });


  }

  contentDetailBack(event:any) : void {

    // scroll to last Y
    window.scrollTo(0,this.lastScrollY);

    this.navigate(this.collectionContent.collection.ref.id);
    // refresh content if signaled
    if (event.refresh) this.refreshContent();
  }


  public refreshAll(){
    this.displayCollectionById(this.collectionContent.collection.ref.id);
  }
  displayCollectionById(id:string,callback:Function=null) : void {
    if (id==null) id=RestConstants.ROOT;
    if (id=="-root-") {

      // display root collections with tabs
      this.setCollectionId(RestConstants.ROOT);
      this.refreshContent(callback);
    } else {

      // load metadata of collection
      this.isLoading=true;

      this.collectionService.getCollection(id).subscribe( collection => {
        // set the collection and load content data by refresh
        this.setCollectionId(null);
        this.collectionContent.collection = collection.collection;

        this.renderBreadcrumbs();

        this.refreshContent(callback);
      }, error => {
        if(id!='-root-'){
          this.navigate();
        }
        if(error.status==404){
          this.toast.error(null,"COLLECTIONS.ERROR_NOT_FOUND");
        }
        else {
          this.toast.error(error);
        }
        this.isLoading=false;
        GlobalContainerComponent.finishPreloading();
      });

    }
  }

  private renderBreadcrumbs() {
    this.path=[];
    this.nodeService.getNodeParents(this.collectionContent.collection.ref.id,false).subscribe((data: EduData.NodeList) => {
      this.path = data.nodes.reverse();
    });
  }
  private openBreadcrumb(position : number){
    if(position==0) {
      this.selectTab(this.tabSelected);
      return;
    }
    this.navigate(this.path[position-1].ref.id);

  }

  private initialize() {

    this.listOptions = this.getOptions(null,true);

    // load user profile
    this.iamService.getUser().subscribe( iamUser => {
      // WIN

      this.person = iamUser.person;

      // set app to ready state
      this.isReady = true;
      // subscribe to parameters of url
      this.route.queryParams.subscribe(params => {
        this.params = params;
        if(params.scope) {
            this.tabSelected = params.scope;
        }else {
            this.tabSelected = this.isGuest ? RestConstants.COLLECTIONSCOPE_ALL : RestConstants.COLLECTIONSCOPE_MY;
        }
        this.reurl=params.reurl;

        if(params.mainnav) {
            this.mainnav = params.mainnav !== 'false';
        }
        this.feedback = params.feedback === 'true';

        this.listOptions = this.getOptions(null,true);

        this._orderActive = false;
        this.infoTitle = null;
        // get id from route and validate input data
        let id = params.id || '-root-';
        if (id==":id") id = "-root-";
        if (id=="") id = "-root-";
        if(params.addToOther){
          this.nodeService.getNodeMetadata(params['addToOther']).subscribe((data:EduData.NodeWrapper)=>{
            this.addToOther=[data.node];
          });
        }
        /*if(params.nodeId){
          let node=params['nodeId'].split("/");
          node=node[node.length-1];
          this.collectionService.addNodeToCollection(id,node).subscribe(()=> this.navigate(id),(error:any)=>{
            this.handleError(error);
            this.navigate(id);
            //this.displayCollectionById(id)
          });
        }
        else {*/
          this.showCollection=id!='-root-';
          this.displayCollectionById(id,(collection:EduData.Collection)=>{
            if(params.content){
              console.log("search content");
              for(let content of this.collectionContent.references) {
                console.log(content);
                if(content.ref.id==params['content']){
                  console.log("match");
                  this.contentDetailObject = content;
                  break;
                }
              }
            }
            this.frame.broadcastEvent(FrameEventsService.EVENT_INVALIDATE_HEIGHT);
          });
        // }

      });

    }, error => {
      // FAIL
      this.toast.error(error);
      this.isReady = true;
    });
  }


  private deleteFromCollection(callback:Function=null) {
    this.globalProgress=true;
    this.collectionService.removeFromCollection(this.contentDetailObject.ref.id,this.collectionContent.collection.ref.id).subscribe(()=>{
      this.toast.toast("COLLECTIONS.REMOVED_FROM_COLLECTION");
      this.globalProgress=false;
      this.refreshContent();
      if(callback) callback();
    },(error:any)=>{
      this.globalProgress=false;
      this.toast.error(error);
    });
  }
    private deleteMultiple(nodes:Node[],position=0,error=false){
            if(position==nodes.length){
                if(!error) {
                    this.toast.toast("COLLECTIONS.REMOVED_FROM_COLLECTION");
                }
                this.globalProgress=false;
                this.refreshContent();
                return;
            }
        this.globalProgress=true;
        this.collectionService.removeFromCollection(nodes[position].ref.id,this.collectionContent.collection.ref.id).subscribe(()=>{
            this.deleteMultiple(nodes,position+1,error);

        },(error:any)=>{
            this.toast.error(error);
            this.deleteMultiple(nodes,position+1,true);
        });
    }
  public closeDialog() {
    this.dialogTitle=null;
  }

  private downloadMaterial() {
    window.open(this.contentDetailObject.downloadUrl);
  }

  private addToOtherCollection(node:EduData.Node) {
    console.log("add to other");
    this.navigate(this.collectionContent.collection.ref.id,node.ref.id);
  }

  private handleError(error: any) {
    if(error.status==RestConstants.DUPLICATE_NODE_RESPONSE){
      this.toast.error(null,'COLLECTIONS.ERROR_NODE_EXISTS');
    }else {
      this.toast.error(error);
    }
  }

  private changeOrder() {
    this.globalProgress=true;
    this.collectionService.setOrder(this.collectionContent.collection.ref.id,RestHelper.getNodeIds(this.collectionContent.references)).subscribe(()=>{
      this.collectionContentOriginal=Helper.deepCopy(this.collectionContent);
      this._orderActive=false;
      this.infoTitle=null;
      this.toast.toast('COLLECTIONS.ORDER_SAVED');
      this.globalProgress=false;
    },(error:any)=>{
      this.globalProgress=false;
      this.toast.error(error);
    });
  }

    private isAllowedToDeleteNodes(nodes: Node[]) {
        return this.isAllowedToDeleteCollection() || NodeHelper.getNodesRight(nodes,RestConstants.ACCESS_DELETE);
    }

    showTabs() {
        return this.isRootLevelCollection() && (!this.isGuest || this.hasEditorial);
    }

    getCollectionViewType() {
        // on mobile, we will always show the small collection list
        if(UIHelper.evaluateMediaQuery(UIConstants.MEDIA_QUERY_MAX_WIDTH,UIConstants.MOBILE_WIDTH)){
            return ListTableComponent.VIEW_TYPE_GRID_SMALL;
        }
        return this.isRootLevelCollection() ? ListTableComponent.VIEW_TYPE_GRID : ListTableComponent.VIEW_TYPE_GRID_SMALL;
    }
    private collectionPermissions(){
        this._collectionShare=this.collectionContent.collection;
    }

    private setOptionsCollection() {
      this.optionsCollection=[];
      if(this.isAllowedToEditCollection()){
          this.optionsCollection.push(new OptionItem("COLLECTIONS.ACTIONBAR.EDIT", "edit",()=>this.collectionEdit()));
      }
      if(this.pinningAllowed && this.isAllowedToDeleteCollection()) {
          this.optionsCollection.push(new OptionItem("COLLECTIONS.ACTIONBAR.PIN", "edu-pin", () => this.pinCollection()));
      }
      if(this.isAllowedToDeleteCollection() && this.connector.hasToolPermissionInstant(RestConstants.TOOLPERMISSION_COLLECTION_FEEDBACK)){
          this.optionsCollection.push(new OptionItem("COLLECTIONS.ACTIONBAR.FEEDBACK_VIEW", "speaker_notes",()=>this.collectionFeedbackView()));
      }
      if(this.isAllowedToEditCollection() && this.collectionContent.collection.type!=RestConstants.COLLECTIONTYPE_EDITORIAL) {
          this.optionsCollection.push(new OptionItem("WORKSPACE.OPTION.INVITE", "group_add", () => this.collectionPermissions()));
      }
      if(this.isAllowedToDeleteCollection()) {
          this.optionsCollection.push(new OptionItem("COLLECTIONS.ACTIONBAR.DELETE", "delete", () => this.collectionDelete()));
      }

      if(this.feedbackAllowed() && !this.isAllowedToDeleteCollection() && this.connector.hasToolPermissionInstant(RestConstants.TOOLPERMISSION_COLLECTION_FEEDBACK)){
          this.optionsCollection.push(new OptionItem("COLLECTIONS.ACTIONBAR.FEEDBACK", "chat_bubble",() => this.collectionFeedback(true)));
      }
    }

    private setCollectionId(id: string) {
        this.collectionContent = {collections:[],references:[]};
        this.collectionContent.collection = new Collection();
        this.collectionContent.collection.ref=new NodeRef();
        this.collectionContent.collection.ref.id = id;
    }

    private getCollectionId() {
        let c=this.collectionContent.collection;
        return c!=null && c.ref!=null ? c.ref.id : null;
    }

    private finishCollectionLoading(callback:Function) {
        this.collectionContentOriginal=Helper.deepCopy(this.collectionContent);
        this.setOptionsCollection();
        this.mainNavRef.refreshBanner();
        if(this.getCollectionId()==RestConstants.ROOT && this.isAllowedToEditCollection()) {
            setTimeout(() => {
                this.tutorialElement = this.listCollections.addElementRef;
            });
        }
        this.isLoading=false;
        if(callback)
            callback();
    }

    private addToStore(nodes:Node[]) {
        this.globalProgress=true;
        RestHelper.addToStore(nodes,this.toast,this.iamService,()=>{
            this.globalProgress=false;
            this.mainNavRef.refreshNodeStore();
        });
    }
    private collectionFeedbackView() {
        this.globalProgress=true;
        this.collectionService.getFeedbacks(this.collectionContent.collection.ref.id).subscribe((data)=>{
            this.feedbacks = data.reverse();
            this.feedbackView = true;
            this.globalProgress=false;
        },(error)=>{
            this.globalProgress=false;
            this.toast.error(error);
        });
    }
    private collectionFeedback(status:boolean) {
        this.navigate(this.collectionContent.collection.ref.id,'',status);
        if(!status && this.params.feedbackClose==='true'){
            window.close();
        }
    }

    addFeedback(data:any) {
        if(!data)
            return;
        delete data[RestConstants.CM_NAME];
        console.log(data);
        this.globalProgress=true;
        this.collectionService.addFeedback(this.collectionContent.collection.ref.id,data).subscribe(()=>{
            this.globalProgress=false;
            this.collectionFeedback(false);
            this.toast.toast('COLLECTIONS.FEEDBACK_TOAST');
        },(error)=>{
            this.globalProgress=false;
            this.toast.error(error);
        })
    }
}
