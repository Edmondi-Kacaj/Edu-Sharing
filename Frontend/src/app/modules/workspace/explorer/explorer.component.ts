import {Component, EventEmitter, Input, Output, ViewChild} from '@angular/core';
import {ConfigurationService, ListItem, Node, NodeList, RestConnectorService, RestConstants, RestNodeService, RestSearchService, SessionStorageService, Store, TemporaryStorageService} from "../../../core-module/core.module";
import {TranslateService} from "@ngx-translate/core";
import {CustomOptions, Scope} from "../../../core-ui-module/option-item";
import {Toast} from "../../../core-ui-module/toast";
import {Helper} from "../../../core-module/rest/helper";
import {ActionbarComponent} from '../../../common/ui/actionbar/actionbar.component';
import {MainNavComponent} from '../../../common/ui/main-nav/main-nav.component';
import {ListTableComponent} from '../../../core-ui-module/components/list-table/list-table.component';
import {DropData} from '../../../core-ui-module/directives/drag-nodes/drag-nodes';

@Component({
  selector: 'workspace-explorer',
  templateUrl: 'explorer.component.html',
  styleUrls: ['explorer.component.scss']
})
export class WorkspaceExplorerComponent {
  public readonly SCOPES = Scope;
  @ViewChild('list') list: ListTableComponent;
  public _nodes: Node[] = [];
  @Input() customOptions: CustomOptions;
  @Input() set nodes(nodes: Node[]) {
    this._nodes = nodes;
  }
  @Output() nodesChange = new EventEmitter<Node[]>();
  public sortBy: string = RestConstants.CM_NAME;
  public sortAscending = RestConstants.DEFAULT_SORT_ASCENDING;


  public columns : ListItem[]=[];
  @Input() viewType = 0;
  @Input() reorderDialog = false;
  @Output() reorderDialogChange = new EventEmitter<boolean>();
  @Input() preventKeyevents:boolean;
  @Input() mainNav:MainNavComponent;
  @Input() actionbar:ActionbarComponent;


  private loading=false;
  public showLoading=false;
  totalCount: number;

  @Input() set showProgress(showProgress:boolean){
    this.showLoading=showProgress;
    if(showProgress){
      this._nodes=[];
    }
  }
  public _searchQuery : string = null;
  _node : Node;
  public hasMoreToLoad :boolean ;
  private lastRequestSearch : boolean;

  @Input() selection : Node[];
  @Input() set current(current : Node){
   this.setNode(current);

  }
  @Input() set searchQuery(query : any){
    this.setSearchQuery(query);
  }
  @Output() onOpenNode=new EventEmitter();
  @Output() onViewNode=new EventEmitter();
  @Output() onSelectionChanged=new EventEmitter();
  @Output() onSelectNode=new EventEmitter();
  @Output() onSearchGlobal=new EventEmitter();
  @Output() onDrop=new EventEmitter();
  @Output() onReset=new EventEmitter();
  private path : Node[];
  public drop(event : any){
    this.onDrop.emit(event);
  }
  searchGlobal(){
    this.onSearchGlobal.emit(this._searchQuery);
  }
  public load(reset : boolean){
    if(this._node==null && !this._searchQuery)
      return;
    if(this.loading){
        setTimeout(()=>this.load(reset),10);
        return;
    }
    if(reset) {
      this.hasMoreToLoad = true;
      this._nodes=[];
      this.onSelectionChanged.emit([]);
      this.onReset.emit();
    }
    else if(!this.hasMoreToLoad){
      return;
    }
    this.loading=true;
    this.showLoading=true;
    // ignore virtual (new) added/uploaded elements
    const offset = this.getRealNodeCount();
	let request: any={offset:offset,propertyFilter:[
	  RestConstants.ALL
	  /*RestConstants.CM_MODIFIED_DATE,
    RestConstants.CM_CREATOR,
    RestConstants.CM_PROP_C_CREATED,
    RestConstants.CCM_PROP_LICENSE,
    RestConstants.LOM_PROP_LIFECYCLE_VERSION,
    RestConstants.CCM_PROP_WF_STATUS,
    RestConstants.CCM_PROP_CCRESSOURCETYPE,
    RestConstants.CCM_PROP_CCRESSOURCESUBTYPE,
    RestConstants.CCM_PROP_CCRESSOURCEVERSION,
    RestConstants.CCM_PROP_WIDTH,
    RestConstants.CCM_PROP_HEIGHT,
    RestConstants.VIRTUAL_PROP_USAGECOUNT,*/
  ],sortBy:[this.sortBy],sortAscending:this.sortAscending};
	if(this._searchQuery){
    let query="*"+this._searchQuery+"*";
    this.lastRequestSearch=true;
    /*this.search.searchByProperties([RestConstants.NODE_ID,RestConstants.CM_PROP_TITLE,RestConstants.CM_NAME,RestConstants.LOM_PROP_DESCRIPTION,RestConstants.LOM_PROP_GENERAL_KEYWORD],
      [query,query,query,query,query],[],RestConstants.COMBINE_MODE_OR,RestConstants.CONTENT_TYPE_FILES_AND_FOLDERS, request).subscribe((data : NodeList) => this.addNodes(data,true));*/
    let criterias:any=[];
    criterias.push({'property': RestConstants.PRIMARY_SEARCH_CRITERIA, 'values': [query]});
    if(this._node){
        criterias.push({'property': 'parent', 'values': [this._node ? this._node.ref.id : ""]});
    }
    this.search.search(criterias,[],request,this.connector.getCurrentLogin() && this.connector.getCurrentLogin().isAdmin ? RestConstants.CONTENT_TYPE_ALL : RestConstants.CONTENT_TYPE_FILES_AND_FOLDERS,RestConstants.HOME_REPOSITORY,
      RestConstants.DEFAULT,[],'workspace').subscribe((data:NodeList)=>{
      this.addNodes(data,true);
    },(error:any)=>{
        this.totalCount=0;
        this.handleError(error);
    });
		//this.nodeApi.searchNodes(query,[],request).subscribe((data : NodeList) => this.addNodes(data,true));
	}
	else{
    this.lastRequestSearch=false;
    this.nodeApi.getChildren(this._node.ref.id,[],request).subscribe((data : NodeList) => this.addNodes(data,false),
      (error:any) => {
        this.totalCount=0;
        this.handleError(error);
      });
	}
  }

    private handleError(error: any) {
        if (error.status == 404)
            this.toast.error(null, "WORKSPACE.TOAST.NOT_FOUND", {id: this._node.ref.id})
        else
            this.toast.error(error);

        this.loading=false;
        this.showLoading=false;
    }
  private addNodes(data: NodeList,wasSearch: boolean){
    if (this.lastRequestSearch !== wasSearch) {
      return;
    }
      if (data && data.nodes) {
        this.totalCount=data.pagination.total;
        this._nodes=this._nodes.concat(data.nodes);
      }
      if (data.pagination.total === this.getRealNodeCount()) {
        this.hasMoreToLoad = false;
      }
      this.nodesChange.emit(this._nodes);
      this.loading=false;
      this.showLoading=false;
  }
  constructor(
    private connector : RestConnectorService,
    private translate : TranslateService,
    private storage : SessionStorageService,
    temporaryStorage : TemporaryStorageService,
    private config : ConfigurationService,
    private search : RestSearchService,
    private toast : Toast,
    private nodeApi : RestNodeService) {
    //super(temporaryStorage,['_node','_nodes','sortBy','sortAscending','columns','totalCount','hasMoreToLoad']);
    this.initColumns();
    this.storage.get(SessionStorageService.KEY_WORKSPACE_SORT, null).subscribe((sort) => {
      if(sort?.sortBy != null) {
        this.setSorting(sort);
      }
    });

  }
  public getColumns(customColumns:any[],configColumns:string[]){
    let defaultColumns:ListItem[]=[];
    defaultColumns.push(new ListItem("NODE", RestConstants.CM_NAME));
    defaultColumns.push(new ListItem("NODE", RestConstants.CM_CREATOR));
    defaultColumns.push(new ListItem("NODE", RestConstants.CM_MODIFIED_DATE));
    if(this.connector.getCurrentLogin() ? this.connector.getCurrentLogin().isAdmin : false){
      defaultColumns.push(new ListItem("NODE", RestConstants.NODE_ID));

      const repsource = new ListItem("NODE", RestConstants.CCM_PROP_REPLICATIONSOURCEID);
      repsource.visible = false;
      defaultColumns.push(repsource);
    }
    let title = new ListItem("NODE", RestConstants.LOM_PROP_TITLE);
    title.visible = false;
    let size = new ListItem("NODE", RestConstants.SIZE);
    size.visible = false;
    let created = new ListItem("NODE", RestConstants.CM_PROP_C_CREATED);
    created.visible = false;
    let mediatype = new ListItem("NODE", RestConstants.MEDIATYPE);
    mediatype.visible = false;
    let keywords = new ListItem("NODE", RestConstants.LOM_PROP_GENERAL_KEYWORD);
    keywords.visible = false;
    let dimensions = new ListItem("NODE", RestConstants.DIMENSIONS);
    dimensions.visible = false;
    let version = new ListItem("NODE", RestConstants.LOM_PROP_LIFECYCLE_VERSION);
    version.visible = false;
    let usage = new ListItem("NODE", RestConstants.VIRTUAL_PROP_USAGECOUNT);
    usage.visible = false;
    let license = new ListItem("NODE", RestConstants.CCM_PROP_LICENSE);
    license.visible = false;
    let wfStatus = new ListItem("NODE", RestConstants.CCM_PROP_WF_STATUS);
    wfStatus.visible = false;
    defaultColumns.push(title);
    defaultColumns.push(size);
    defaultColumns.push(created);
    defaultColumns.push(mediatype);
    defaultColumns.push(keywords);
    defaultColumns.push(dimensions);
    defaultColumns.push(version);
    defaultColumns.push(usage);
    defaultColumns.push(license);
    defaultColumns.push(wfStatus);

    if(Array.isArray(configColumns)){
      let configList:ListItem[]=[];
      for(let col of defaultColumns){
        if(configColumns.indexOf(col.name)!=-1){
          col.visible=true;
          configList.push(col);
        }
      }
      for(let col of defaultColumns){
        if(configColumns.indexOf(col.name)==-1){
          col.visible=false;
          configList.push(col);
        }
      }
      defaultColumns=configList;
    }
    if(Array.isArray(customColumns)){
      for(let column of defaultColumns){
        let add=true;
        for(let column2 of customColumns){
          if(column.name==column2.name){
            add=false;
            break;
          }
        }
        if(add)
          customColumns.push(column);
      }
      return customColumns;
    }
    return defaultColumns;
  }
  public setSorting(data:any){
    this.sortBy=data.sortBy;
    this.sortAscending=data.sortAscending;
    this.storage.set(SessionStorageService.KEY_WORKSPACE_SORT, data);
    this.load(true);
  }
  public onSelection(event : Node[]){
    this.onSelectionChanged.emit(event);
  }
  /*
  private addParentToPath(node : Node,path : string[]) {

    path.splice(1,0,node.ref.id);
    if (node.parent.id==path[0] || node.parent.id==null) {
      this.onOpenNode.emit(node);
      return;
    }
    this.nodeApi.getNodeMetadata(node.parent.id).subscribe((data: NodeWrapper)=> {
      this.addParentToPath(data.node, path);
    });

  }
   */
  public doubleClick(node : Node){
    this.onOpenNode.emit(node);
  }

  private setNode(current: Node) {
    setTimeout(()=>{
      this._searchQuery=null;
      if(!current) {
        this._node=null;
        return;
      }
      if(this.loading){
        setTimeout(()=>this.setNode(current),10);
        return;
      }
      if(Helper.objectEquals(this._node,current))
          return;
        this._node=current;
        this.load(true);
    });
  }

  private setSearchQuery(query: any) {
    setTimeout(()=> {
      if (this.showLoading) {
        setTimeout(() => this.setSearchQuery(query), 10);
        return;
      }
      if (query && query.query) {
        this._searchQuery = query.query;
        this._node=query.node;
        this.load(true);
      }
      else{
        this._searchQuery=null;
      }
    });
  }
  canDrop = (event: DropData)=> {
    return event.target.isDirectory;
  }

  private getRealNodeCount() {
    return this._nodes.filter((n) => !n.virtual).length;
  }

  initColumns() {
    this.config.get('workspaceColumns').subscribe((data:string[])=> {
      this.storage.get('workspaceColumns').subscribe((columns:any[])=> {
        this.columns = this.getColumns(columns, data);
      });
    });
  }
}
