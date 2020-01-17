import { Component, ElementRef, HostListener, ViewChild } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Translation } from '../../core-ui-module/translation';
import {
    ClipboardObject,
    ConfigurationService,
    Connector,
    ConnectorList, DialogButton,
    EventListener,
    Filetype,
    FrameEventsService,
    IamUser,
    LoginResult,
    Node,
    NodeList,
    NodeRef,
    NodeVersions,
    NodeWrapper,
    RestCollectionService,
    RestConnectorService,
    RestConnectorsService,
    RestConstants,
    RestHelper,
    RestIamService,
    RestMdsService,
    RestNodeService,
    RestToolService,
    SessionStorageService,
    TemporaryStorageService,
    UIService,
    Version
} from '../../core-module/core.module';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { OptionItem } from '../../core-ui-module/option-item';
import { Toast } from '../../core-ui-module/toast';
import { UIAnimation } from '../../core-module/ui/ui-animation';
import { NodeHelper } from '../../core-ui-module/node-helper';
import { KeyEvents } from '../../core-module/ui/key-events';
import { Title } from '@angular/platform-browser';
import { UIHelper } from '../../core-ui-module/ui-helper';
import { trigger } from '@angular/animations';
import { UIConstants } from '../../core-module/ui/ui-constants';
import { ActionbarHelperService } from '../../common/services/actionbar-helper';
import { Helper } from '../../core-module/rest/helper';
import { DateHelper } from '../../core-ui-module/DateHelper';
import { CordovaService } from '../../common/services/cordova.service';
import { HttpClient } from '@angular/common/http';
import { MainNavComponent } from '../../common/ui/main-nav/main-nav.component';
import { MatMenuTrigger } from '@angular/material';
import { GlobalContainerComponent } from '../../common/ui/global-container/global-container.component';

@Component({
    selector: 'workspace-main',
    templateUrl: 'workspace.component.html',
    styleUrls: ['workspace.component.scss'],
    animations: [
        trigger('fade', UIAnimation.fade()),
        trigger('fadeFast', UIAnimation.fade(UIAnimation.ANIMATION_TIME_FAST)),
        trigger('overlay', UIAnimation.openOverlay(UIAnimation.ANIMATION_TIME_FAST)),
        trigger('fromLeft', UIAnimation.fromLeft()),
        trigger('fromRight', UIAnimation.fromRight())
    ]
})
export class WorkspaceMainComponent implements EventListener {
    @ViewChild('dropdownTrigger') dropdownTrigger: MatMenuTrigger;
    private static VALID_ROOTS = ['MY_FILES', 'SHARED_FILES', 'MY_SHARED_FILES', 'TO_ME_SHARED_FILES', 'WORKFLOW_RECEIVE', 'RECYCLE'];
    private static VALID_ROOTS_NODES = [RestConstants.USERHOME, '-shared_files-', '-my_shared_files-', '-to_me_shared_files-', '-workflow_receive-'];
    private isRootFolder: boolean;
    private homeDirectory: string;
    private sharedFolders: Node[] = [];
    private path: Node[] = [];
    private parameterNode: Node;
    private metadataNode: String;
    private root = 'MY_FILES';

    private explorerOptions: OptionItem[] = [];
    private actionOptions: OptionItem[] = [];
    private selection: Node[] = [];
    public fileIsOver = false;

    private showSelectRoot = false;
    public showUploadSelect = false;
    createConnectorName: string;
    createConnectorType: Connector;
    private addFolderName: string;

    public allowBinary = true;
    private filesToUpload: FileList;
    public globalProgress = false;
    public editNodeMetadata: Node;
    public editNodeTemplate: Node;
    public editNodeDeleteOnCancel = false;
    private createMds: string;
    private editNodeLicense: Node[];
    private editNodeAllowReplace: Boolean;
    private nodeDisplayedVersion: string;
    private createAllowed: boolean;
    private currentFolder: any | Node;
    private user: IamUser;
    public searchQuery: any;
    public isSafe = false;
    private isLoggedIn = false;
    public addNodesToCollection: Node[];
    public addNodesStream: Node[];
    public variantNode: Node;
    @ViewChild('mainNav') mainNavRef: MainNavComponent;
    private connectorList: Connector[];
    private nodeOptions: OptionItem[] = [];
    private currentNode: Node;
    public mainnav = true;
    private timeout: string;
    private timeIsValid = false;
    private viewToggle: OptionItem;
    private isAdmin = false;
    public isBlocked = false;
    private isGuest: boolean;
    private currentNodes: Node[];
    private appleCmd = false;
    public workflowNode: Node;
    public deleteNode: Node[];
    private reurl: string;
    private mdsParentNode: Node;
    public showLtiTools = false;
    private oldParams: Params;
    private selectedNodeTree: string;
    private nodeDebug: Node;
    private sharedNode: Node;
    public contributorNode: Node;
    public shareLinkNode: Node;
    private viewType = 0;
    private infoToggle: OptionItem;
    private reurlDirectories: boolean;
    @HostListener('window:beforeunload', ['$event'])
    beforeunloadHandler(event: any) {
        if (this.isSafe) {
            this.connector.logoutSync();
        }
    }
    @HostListener('window:scroll', ['$event'])
    handleScroll(event: Event) {
        const scroll = (window.pageYOffset || document.documentElement.scrollTop);
        if (scroll > 0) {
            this.storage.set('workspace_scroll', scroll);
        }
    }
    @HostListener('document:keyup', ['$event'])
    handleKeyboardEventUp(event: KeyboardEvent) {
        if (event.keyCode === 91 || event.keyCode === 93) {
            this.appleCmd = false;
        }
    }
    @HostListener('document:keydown', ['$event'])
    handleKeyboardEvent(event: KeyboardEvent) {
        if (event.keyCode === 91 || event.keyCode === 93) {
            this.appleCmd = true;
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        const clip = (this.storage.get('workspace_clipboard') as ClipboardObject);
        const fromInputField = KeyEvents.eventFromInputField(event);
        const hasOpenWindow = this.hasOpenWindows();
        if (event.code === 'KeyX' && (event.ctrlKey || this.appleCmd) && this.selection.length && !hasOpenWindow && !fromInputField) {
            this.cutCopyNode(null, false);
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        if (event.code === 'F2' && this.selection.length === 1 && !hasOpenWindow && !fromInputField) {
            this.editNode(this.selection[0]);
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        if (event.code === 'KeyC' && (event.ctrlKey || this.appleCmd) && this.selection.length && !hasOpenWindow && !fromInputField) {
            this.cutCopyNode(null, true);
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        if (event.code === 'KeyV' && (event.ctrlKey || this.appleCmd) && clip && !hasOpenWindow && !fromInputField) {
            this.pasteNode();
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        if (event.code === 'Delete' && !hasOpenWindow && !fromInputField && this.selection.length) {
            this.deleteNodes();
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        if (event.key === 'Escape') {
            if (this.addFolderName != null) {
                this.addFolderName = null;
            }
            else if (this.showUploadSelect) {
                this.showUploadSelect = false;
            }
            else if (this.createConnectorName != null) {
                this.createConnectorName = null;
            }
            else if (this.metadataNode != null) {
                this.closeMetadata();
            }
            else {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
        }
    }
    onEvent(event: string, data: any): void {
        if (event === FrameEventsService.EVENT_REFRESH) {
            this.refresh();
        }
    }
    constructor(
        private toast: Toast,
        private route: ActivatedRoute,
        private router: Router,
        private http: HttpClient,
        private translate: TranslateService,
        private storage: TemporaryStorageService,
        private config: ConfigurationService,
        private connectors: RestConnectorsService,
        private actionbar: ActionbarHelperService,
        private collectionApi: RestCollectionService,
        private toolService: RestToolService,
        private session: SessionStorageService,
        private iam: RestIamService,
        private mds: RestMdsService,
        private node: RestNodeService,
        private ui: UIService,
        private title: Title,
        private event: FrameEventsService,
        private connector: RestConnectorService,
        private cordova: CordovaService
    ) {
        this.event.addListener(this);
        Translation.initialize(translate, this.config, this.session, this.route).subscribe(() => {
            UIHelper.setTitle('WORKSPACE.TITLE', title, translate, config);
            this.initialize();
        });
        this.connector.setRoute(this.route);
        this.globalProgress = true;
        this.explorerOptions = this.getOptions(null, true);
        // this.nodeOptions.push(new OptionItem("DOWNLOAD", "cloud_download", (node:Node) => this.downloadNode(node)));
    }
    private uploadCamera(event: any) {
        this.filesToUpload = event.target.files;
    }
    private hideDialog(): void {
        this.toast.closeModalDialog();
    }
    private openCamera() {
        this.cordova.getPhotoFromCamera((data: any) => {
            console.log(data);
            const name = this.translate.instant('SHARE_APP.IMAGE')
                + ' '
                + DateHelper.formatDate(this.translate, new Date().getTime(), { showAlwaysTime: true, useRelativeLabels: false })
                + '.jpg';
            const blob: any = Helper.base64toBlob(data, 'image/jpeg');
            blob.name = name;
            const list: any = {};
            list.item = (i: number) => {
                return blob;
            };
            list.length = 1;
            this.filesToUpload = list;
        }, (error: any) => {
            console.warn(error);
            // this.toast.error(error);
        });
    }
    showCreateConnector(connector: Connector) {
        this.createConnectorName = '';
        this.createConnectorType = connector;
        this.iam.getUser().subscribe((user) => {
            if (user.person.quota.enabled && user.person.quota.sizeCurrent >= user.person.quota.sizeQuota) {
                this.toast.showModalDialog('CONNECTOR_QUOTA_REACHED_TITLE', 'CONNECTOR_QUOTA_REACHED_MESSAGE', DialogButton.getOk(() => {
                    this.toast.closeModalDialog();
                }), true);
                this.createConnectorName = null;
            }
        });
    }
    private createConnector(event: any) {
        const name = event.name + '.' + event.type.filetype;
        this.createConnectorName = null;
        const prop = NodeHelper.propertiesFromConnector(event);
        let win: any;
        if (!this.cordova.isRunningCordova()) {
            win = window.open('');
        }
        this.node.createNode(this.currentFolder.ref.id, RestConstants.CCM_TYPE_IO, [], prop, false).subscribe(
            (data: NodeWrapper) => {
                this.editConnector(data.node, event.type, win, this.createConnectorType);
                this.refresh();
            },
            (error: any) => {
                win.close();
                if (NodeHelper.handleNodeError(this.toast, event.name, error) === RestConstants.DUPLICATE_NODE_RESPONSE) {
                    this.createConnectorName = event.name;
                }
            }
        );
    }
    private editConnector(node: Node = null, type: Filetype = null, win: any = null, connectorType: Connector = null) {
        UIHelper.openConnector(this.connectors, this.iam, this.event, this.toast, this.getNodeList(node)[0], type, win, connectorType);
    }
    private handleDrop(event: any) {
        for (const s of event.source) {
            if (event.target.ref.id === s.ref.id || event.target.ref.id === s.parent.id) {
                this.toast.error(null, 'WORKSPACE.SOURCE_TARGET_IDENTICAL');
                return;
            }
        }
        if (!event.target.isDirectory) {
            this.toast.error(null, 'WORKSPACE.TARGET_NO_DIRECTORY');
            return;
        }
        if (event.event.altKey) {
            this.toast.error(null, 'WORKSPACE.FEATURE_NOT_IMPLEMENTED');
        }
        else if (event.type === 'copy') {
            this.copyNode(event.target, event.source);
        }
        else {
            this.moveNode(event.target, event.source);
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
    canDropBreadcrumbs = (event: any) => event.target.ref.id !== this.currentFolder.ref.id;
    private moveNode(target: Node, source: Node[], position = 0) {
        this.globalProgress = true;
        if (position >= source.length) {
            this.finishMoveCopy(target, source, false);
            this.globalProgress = false;
            return;
        }
        this.node.moveNode(target.ref.id, source[position].ref.id).subscribe((data: NodeWrapper) => {
            this.moveNode(target, source, position + 1);
        },
            (error: any) => {
                NodeHelper.handleNodeError(this.toast, source[position].name, error);
                source.splice(position, 1);
                this.moveNode(target, source, position + 1);
            });
    }
    private copyNode(target: Node, source: Node[], position = 0) {
        this.globalProgress = true;
        if (position >= source.length) {
            this.finishMoveCopy(target, source, true);
            this.globalProgress = false;
            return;
        }
        this.node.copyNode(target.ref.id, source[position].ref.id).subscribe((data: NodeWrapper) => {
            this.copyNode(target, source, position + 1);
        },
            (error: any) => {
                NodeHelper.handleNodeError(this.toast, source[position].name, error);
                source.splice(position, 1);
                this.copyNode(target, source, position + 1);
            });
    }
    private finishMoveCopy(target: Node, source: Node[], copy: boolean) {
        this.toast.closeModalDialog();
        const info: any = {
            to: target.name,
            count: source.length,
            mode: this.translate.instant('WORKSPACE.' + (copy ? 'PASTE_COPY' : 'PASTE_MOVE'))
        };
        if (source.length) {
            this.toast.toast('WORKSPACE.TOAST.PASTE_DRAG', info);
        }
        this.globalProgress = false;
        this.refresh();
    }
    private initialize() {
        this.route.params.subscribe((params: Params) => {
            this.isSafe = params.mode === 'safe';
            this.connector.isLoggedIn().subscribe((data: LoginResult) => {
                if (data.statusCode !== RestConstants.STATUS_CODE_OK) {
                    RestHelper.goToLogin(this.router, this.config);
                    return;
                }
                this.iam.getUser().subscribe((user: IamUser) => {
                    this.user = user;
                    this.loadFolders(user);

                    let valid = true;
                    this.isGuest = data.isGuest;
                    if (!data.isValidLogin || data.isGuest) {
                        valid = false;
                    }
                    this.isBlocked = !this.connector.hasToolPermissionInstant(RestConstants.TOOLPERMISSION_WORKSPACE);
                    this.isAdmin = data.isAdmin;
                    if (this.isSafe && data.currentScope !== RestConstants.SAFE_SCOPE) {
                        valid = false;
                    }
                    if (!this.isSafe && data.currentScope != null) {
                        valid = false;
                    }
                    if (!valid) {
                        this.goToLogin();
                        return;
                    }
                    this.connector.scope = this.isSafe ? RestConstants.SAFE_SCOPE : null;
                    this.isLoggedIn = true;
                    this.node.getHomeDirectory().subscribe((data: NodeRef) => {
                        this.globalProgress = false;
                        this.homeDirectory = data.id;
                        this.route.params.forEach((params: Params) => {
                            this.route.queryParams.subscribe((params: Params) => {

                                this.connectors.list().subscribe(() => {
                                    this.connectorList = this.connectors.getConnectors();
                                    console.log(params);
                                    if (params.connector) {
                                        this.showCreateConnector(this.connectorList.filter((c) => c.id === params.connector)[0]);
                                    }
                                });

                                let needsUpdate = false;
                                if (this.oldParams) {
                                    for (const key of Object.keys(this.oldParams).concat(Object.keys(params))) {
                                        if (params[key] !== this.oldParams[key] && key !== 'viewType') {
                                            console.log('changed ' + key);
                                            needsUpdate = true;
                                        }
                                    }
                                }
                                else {
                                    needsUpdate = true;
                                }
                                this.oldParams = params;
                                if (params.viewType) {
                                    this.viewType = params.viewType;
                                }
                                if (params.root && WorkspaceMainComponent.VALID_ROOTS.indexOf(params.root) !== -1) {
                                    this.root = params.root;
                                }
                                else {
                                    this.root = 'MY_FILES';
                                }
                                if (params.reurl) {
                                    this.reurl = params.reurl;
                                }
                                this.reurlDirectories = params.applyDirectories === 'true';
                                this.createAllowed = this.root === 'MY_FILES';
                                this.mainnav = params.mainnav === 'false' ? false : true;

                                if (params.file) {
                                    this.node.getNodeMetadata(params.file).subscribe((data: NodeWrapper) => {
                                        this.setSelection([data.node]);
                                        this.parameterNode = data.node;
                                        this.metadataNode = params.file;
                                    });
                                }

                                if (!needsUpdate) {
                                    return;
                                }

                                this.openDirectoryFromRoute(params);
                                if (params.showAlpha) {
                                    this.showAlpha();
                                }
                            });
                        });
                    });
                });
            });
        });
    }
    public resetWorkspace() {
        if (this.metadataNode && this.parameterNode) {
            this.setSelection([this.parameterNode]);
        }
    }

    public doSearch(query: any) {
        const id = this.currentFolder ? this.currentFolder.ref.id :
            this.searchQuery && this.searchQuery.node ? this.searchQuery.node.ref.id : null;
        this.routeTo(this.root, id, query.query);
        if (!query.cleared) {
            this.ui.hideKeyboardIfMobile();
        }
    }
    private doSearchFromRoute(params: any, node: Node | any) {
        node = this.isRootFolder ? null : node;
        this.searchQuery = {
            query: params.query,
            node
        };
        if (node == null && this.root !== 'RECYCLE') {
            this.root = 'ALL_FILES';
        }
        this.createAllowed = false;
        this.path = [];
        this.selection = [];
        this.actionOptions = this.getOptions(null, false);

        /*
        if(this.root=='MY_SHARED_FILES' || this.root=='SHARED_FILES')
            this.root='MY_FILES';
        */
    }
    private manageContributorsNode(node: Node) {
        const list = this.getNodeList(node);
        this.contributorNode = list[0];
    }
    private manageWorkflowNode(node: Node) {
        const list = this.getNodeList(node);
        this.workflowNode = list[0];
    }
    private setShareLinkNode(node: Node) {
        const list = this.getNodeList(node);
        this.shareLinkNode = list[0];
    }
    private shareNode(node: Node) {
        const list = this.getNodeList(node);
        this.sharedNode = list[0];
    }
    private editNode(node: Node) {
        const list = this.getNodeList(node);
        this.editNodeMetadata = list[0];
        this.editNodeAllowReplace = new Boolean(true);
    }
    private editLicense(node: Node) {
        const list = this.getNodeList(node);
        this.editNodeLicense = list;
    }
    private addFolder(folder: any) {
        this.addFolderName = null;
        this.globalProgress = true;
        const properties = RestHelper.createNameProperty(folder.name);
        if (folder.metadataset) {
            properties[RestConstants.CM_PROP_METADATASET_EDU_METADATASET] = [folder.metadataset];
            properties[RestConstants.CM_PROP_METADATASET_EDU_FORCEMETADATASET] = ['true'];
        }
        this.node.createNode(this.currentFolder.ref.id, RestConstants.CM_TYPE_FOLDER, [], properties).subscribe(
            (data: NodeWrapper) => {
                // this.openNode(data.node.ref.id,false);
                this.globalProgress = false;
                this.refresh();
                this.toast.toast('WORKSPACE.TOAST.FOLDER_ADDED');
            },
            (error: any) => {
                this.globalProgress = false;
                if (NodeHelper.handleNodeError(this.toast, folder.name, error) === RestConstants.DUPLICATE_NODE_RESPONSE) {
                    this.addFolderName = folder.name;
                }
            }
        );
    }
    private afterUpload(node: Node[]) {
        if (this.reurl) {
            NodeHelper.addNodeToLms(this.router, this.storage, node[0], this.reurl);
        }
    }
    private uploadFiles(files: FileList) {
        this.onFileDrop(files);
    }
    public onFileDrop(files: FileList) {
        if (!this.showUploadSelect && this.hasOpenWindows()) {
            return;
        }
        if (this.searchQuery) {
            this.toast.error(null, 'WORKSPACE.TOAST.NOT_POSSIBLE_IN_SEARCH');
            return;
        }
        if (!this.createAllowed) {
            this.toast.error(null, 'WORKSPACE.TOAST.NO_WRITE_PERMISSION');
            return;
        }
        if (this.filesToUpload) {
            this.toast.error(null, 'WORKSPACE.TOAST.ONGOING_UPLOAD');
            return;
        }
        this.showUploadSelect = false;
        this.filesToUpload = files;
    }


    private deleteNodes(node: Node = null) {
        const list = this.getNodeList(node);
        if (list == null) {
            return;
        }
        this.deleteNode = list;
    }
    private deleteDone(data: any) {
        this.metadataNode = null;
        this.refresh();
    }

    private pasteNode(position = 0) {
        const clip = (this.storage.get('workspace_clipboard') as ClipboardObject);
        if (!this.canPasteInCurrentLocation()) {
            return;
        }
        if (position >= clip.nodes.length) {
            this.globalProgress = false;
            this.storage.remove('workspace_clipboard');
            const info: any = {
                from: clip.sourceNode ? clip.sourceNode.name : this.translate.instant('WORKSPACE.COPY_SEARCH'),
                to: this.currentFolder.name,
                count: clip.nodes.length,
                mode: this.translate.instant('WORKSPACE.' + (clip.copy ? 'PASTE_COPY' : 'PASTE_MOVE'))
            };
            this.toast.toast('WORKSPACE.TOAST.PASTE', info);
            this.refresh();
            return;
        }
        this.globalProgress = true;
        const target = this.currentFolder.ref.id;
        console.log(this.currentFolder);
        const source = clip.nodes[position].ref.id;
        if (clip.copy) {
            this.node.copyNode(target, source).subscribe(
                (data: NodeWrapper) => this.pasteNode(position + 1),
                (error: any) => {
                    NodeHelper.handleNodeError(this.toast, clip.nodes[position].name, error);
                    this.globalProgress = false;
                });
        }
        else {
            this.node.moveNode(target, source).subscribe(
                (data: NodeWrapper) => this.pasteNode(position + 1),
                (error: any) => {
                    NodeHelper.handleNodeError(this.toast, clip.nodes[position].name, error);
                    this.globalProgress = false;
                }
            );
        }

    }
    private cutCopyNode(node: Node, copy: boolean) {
        let list = this.getNodeList(node);
        if (!list || !list.length) {
            return;
        }
        list = Helper.deepCopy(list);
        const clip: ClipboardObject = { sourceNode: this.currentFolder, nodes: list, copy };
        this.storage.set('workspace_clipboard', clip);
        this.toast.toast('WORKSPACE.TOAST.CUT_COPY', { count: list.length });
    }
    private downloadNode(node: Node) {
        const list = this.getNodeList(node);
        NodeHelper.downloadNodes(this.toast, this.connector, list);
    }
    private displayNode(event: Node) {
        const list = this.getNodeList(event);
        this.closeMetadata();
        if (list[0].isDirectory) {
            this.openDirectory(list[0].ref.id);
        }
        else {
            /*
            this.nodeDisplayed = event;
            this.nodeDisplayedVersion = event.version;
            */
            this.currentNode = list[0];
            this.storage.set(TemporaryStorageService.NODE_RENDER_PARAMETER_OPTIONS, this.nodeOptions);
            this.storage.set(TemporaryStorageService.NODE_RENDER_PARAMETER_LIST, this.currentNodes);
            this.storage.set(TemporaryStorageService.NODE_RENDER_PARAMETER_ORIGIN, 'workspace');
            this.router.navigate([UIConstants.ROUTER_PREFIX + 'render', list[0].ref.id, list[0].version ? list[0].version : '']);
        }
    }
    private restoreVersion(restore:{version: Version,node: Node}) {
        this.toast.showConfigurableDialog({
            title: 'WORKSPACE.METADATA.RESTORE_TITLE',
            message: 'WORKSPACE.METADATA.RESTORE_MESSAGE',
            buttons: DialogButton.getYesNo(() => this.hideDialog(), () => this.doRestoreVersion(restore.version)),
            node: restore.node,
            isCancelable: true,
            onCancel: () => this.hideDialog(),
        });
    }
    // returns either the passed node as list, or the current selection if the passed node is invalid (actionbar)
    private getNodeList(node: Node): Node[] {
        if (Array.isArray(node)) {
            return node;
        }
        let nodes = [node];
        if (node == null) {
            nodes = this.selection;
        }
        return nodes;
    }

    private loadFolders(user: IamUser) {
        for (const folder of user.person.sharedFolders) {
            this.node.getNodeMetadata(folder.id).subscribe((node: NodeWrapper) => this.sharedFolders.push(node.node));
        }
    }
    private setRoot(root: string) {
        this.root = root;
        this.searchQuery = null;
        this.routeTo(root, null, null);
    }
    private updateList(nodes: Node[]) {
        this.currentNodes = nodes;
    }

    private clickNode(node: Node) {
        // if(!this.selection || this.selection.length<2)
        this.setSelection([node]);

        if (!node.isDirectory) {
            if (this.ui.isMobile()) {
                this.displayNode(node);
            }
            else {
                if (this.metadataNode) {
                    this.openMetadata(node);
                }
            }
        }
        else {
            // this.closeMetadata();
            if (this.ui.isMobile()) {
                this.openDirectory(node.ref.id);
            }
            else if (this.metadataNode) {
                this.openMetadata(node);
            }
        }
    }
    private openMetadata(node: Node | string) {
        const old = this.metadataNode;
        if (node == null) {
            node = this.selection[0];
        }
        if (typeof node === 'string') {
            this.metadataNode = new String((node as string));
        }
        else {
            this.metadataNode = new String((node as Node).ref.id);
        }
        this.infoToggle.icon = 'info';
        if (old && this.metadataNode.toString() === old.toString()) {
            this.closeMetadata();
        }
    }
    public updateOptions(node: Node): void {
        this.explorerOptions = this.getOptions(node ? [node] : null, true);
    }


    public debugNode(node: Node) {
        this.nodeDebug = this.getNodeList(node)[0];
        /*
        this.session.set("admin_lucene",{
            query:'@sys\:node-uuid:"'+node.ref.id+'"',
            offset:0,
            count:10,
        });
        this.router.navigate([UIConstants.ROUTER_PREFIX,"admin"],{queryParams:{mode:'BROWSER'}});
        */
    }
    public getOptions(nodes: Node[], fromList: boolean): OptionItem[] {
        if (nodes && !nodes.length) {
            nodes = null;
        }
        const options: OptionItem[] = [];

        const allFiles = NodeHelper.allFiles(nodes);
        const savedSearch = nodes && nodes.length && nodes[0].type === RestConstants.CCM_TYPE_SAVED_SEARCH;
        if (!nodes && this.canPasteInCurrentLocation()) {
            options.push(new OptionItem('WORKSPACE.OPTION.PASTE', 'content_paste', (node: Node) => this.pasteNode()));
        }
        if (fromList || nodes && nodes.length === 1) {
            if (this.reurl) {
                const apply = new OptionItem('APPLY', 'redo', (node: Node) => this.applyNode(this.getNodeList(node)[0]));
                apply.showAsAction = true;
                apply.showAlways = true;
                apply.enabledCallback = ((node: Node) => {
                    return node.access.indexOf(RestConstants.ACCESS_CC_PUBLISH) !== -1;
                });
                apply.showCallback = ((node: Node) => {
                    const result = NodeHelper.getActionbarNodes(nodes, node);
                    if (result == null || !result.length) {
                        return false;
                    }
                    return (this.reurlDirectories || !result[0].isDirectory);
                });
                // if (fromList || apply.showCallback(nodes[0]))
                options.push(apply);
            }
        }
        if (nodes && nodes.length === 1) {
            if (this.isAdmin || (window as any).esDebug === true) {
                const debug = new OptionItem('WORKSPACE.OPTION.DEBUG', 'build', (node: Node) => this.debugNode(node));
                debug.onlyDesktop = true;
                options.push(debug);
            }
            const open = new OptionItem('WORKSPACE.OPTION.SHOW', 'remove_red_eye', (node: Node) => this.displayNode(node));
            if (!nodes[0].isDirectory && !savedSearch) {
                options.push(open);
            }
        }
        const view = new OptionItem('WORKSPACE.OPTION.VIEW', 'launch', (node: Node) => this.editConnector(node));
        if (fromList) {
            view.showCallback = ((node: Node) => {
                return this.connectors.connectorSupportsEdit(node) != null;
            });
            options.push(view);
        }
        else if (nodes && nodes.length === 1 && this.connectors.connectorSupportsEdit(nodes[0])) {
            options.push(view);
        }
        if (nodes && nodes.length === 1 && !savedSearch) {
            const edit = new OptionItem('WORKSPACE.OPTION.EDIT', 'info_outline', (node: Node) => this.editNode(node));
            edit.isEnabled = NodeHelper.getNodesRight(nodes, RestConstants.ACCESS_WRITE);
            edit.isSeperateBottom = true;
            if (edit.isEnabled) {
                options.push(edit);
            }
        }
        const collection = this.actionbar.createOptionIfPossible('ADD_TO_COLLECTION', nodes, (node: Node) => this.addToCollection(node));
        if (collection && !this.isSafe) {
            options.push(collection);
        }
        const stream = this.actionbar.createOptionIfPossible('ADD_TO_STREAM', nodes, (node: Node) => this.addToStream(node));
        if (stream && !this.isSafe) {
            options.push(stream);
        }
        const variant = this.actionbar.createOptionIfPossible('CREATE_VARIANT', nodes, (node: Node) => this.createVariant(node));
        if (variant && !this.isSafe) {
            options.push(variant);
        }

        let share: OptionItem;
        const template = this.actionbar.createOptionIfPossible('NODE_TEMPLATE', nodes, (node: Node) => this.nodeTemplate(node));
        if (template) {
            options.push(template);
        }
        share = this.actionbar.createOptionIfPossible('INVITE', nodes, (node: Node) => this.shareNode(node));
        if (share) {
            share.isEnabled = share.isEnabled && (
                (this.connector.hasToolPermissionInstant(RestConstants.TOOLPERMISSION_INVITE) && !this.isSafe)
                || (this.connector.hasToolPermissionInstant(RestConstants.TOOLPERMISSION_INVITE_SAFE) && this.isSafe)
            );
            options.push(share);
        }
        /*let shareLink = ActionbarHelper
            .createOptionIfPossible('SHARE_LINK',nodes,this.connector,(node: Node) => this.setShareLinkNode(node));
        if (shareLink && !this.isSafe)
            options.push(shareLink);*/

        if (nodes) {
            const license = new OptionItem('WORKSPACE.OPTION.LICENSE', 'copyright', (node: Node) => this.editLicense(node));
            license.isEnabled = !this.isSafe
                && allFiles
                && NodeHelper.getNodesRight(nodes, RestConstants.ACCESS_DELETE)
                && this.connector.hasToolPermissionInstant(RestConstants.TOOLPERMISSION_LICENSE);
            if (license.isEnabled) {
                options.push(license);
            }
        }
        if (nodes && nodes.length === 1 && !savedSearch) {
            const contributor = new OptionItem('WORKSPACE.OPTION.CONTRIBUTOR', 'group', (node: Node) => this.manageContributorsNode(node));
            contributor.isEnabled = NodeHelper.getNodesRight(nodes, RestConstants.ACCESS_WRITE);
            contributor.onlyDesktop = true;
            if (nodes && !nodes[0].isDirectory && !this.isSafe) {
                options.push(contributor);
            }
            const workflow = this.actionbar.createOptionIfPossible('WORKFLOW', nodes, (node: Node) => this.manageWorkflowNode(node));
            if (workflow) {
                options.push(workflow);
            }


            this.infoToggle = new OptionItem('WORKSPACE.OPTION.METADATA', 'info_outline', (node: Node) => this.openMetadata(node));
            this.infoToggle.isToggle = true;
            options.push(this.infoToggle);

        }
        if (fromList || nodes && nodes.length) {
            const download = this.actionbar.createOptionIfPossible('DOWNLOAD', nodes, (node: Node) => this.downloadNode(node));
            if (download) {
                options.push(download);
            }
        }
        if (nodes && nodes.length) {
            const cut = new OptionItem('WORKSPACE.OPTION.CUT', 'content_cut', (node: Node) => this.cutCopyNode(node, false));
            cut.isSeperate = true;
            cut.isEnabled = NodeHelper.getNodesRight(nodes, RestConstants.ACCESS_WRITE)
                && (this.root === 'MY_FILES' || this.root === 'SHARED_FILES');
            options.push(cut);
            options.push(new OptionItem('WORKSPACE.OPTION.COPY', 'content_copy', (node: Node) => this.cutCopyNode(node, true)));
            const del = this.actionbar.createOptionIfPossible('DELETE', nodes, (node: Node) => this.deleteNodes(node));
            if (del) {
                options.push(del);
            }
            const custom = this.config.instant('nodeOptions');
            NodeHelper.applyCustomNodeOptions(this.toast, this.http, this.connector, custom, this.currentNodes, nodes, options,
                (load: boolean) => this.globalProgress = load
            );
        }
        if (!fromList && this.root !== 'RECYCLE') {
            this.viewToggle = new OptionItem('', this.viewType === 0 ? 'view_module' : 'list', (node: Node) => this.toggleView());
            this.viewToggle.isToggle = true;
            options.push(this.viewToggle);
        }
        return options;
    }
    private setSelection(nodes: Node[]) {
        this.selection = nodes;
        this.actionOptions = this.getOptions(nodes, false);
        this.setFixMobileNav();
    }
    private setFixMobileNav() {
        this.mainNavRef.setFixMobileElements(this.selection && this.selection.length > 0);
    }
    private updateLicense() {
        this.closeMetadata();
    }
    private closeMetadata() {
        this.metadataNode = null;
        if (this.infoToggle) {
            this.infoToggle.icon = 'info_outline';
        }
    }
    private openDirectory(id: string) {
        this.routeTo(this.root, id);
    }
    searchGlobal(query: string) {
        this.routeTo(this.root, null, query);
    }
    private openDirectoryFromRoute(params: any) {
        let id = params.id;
        this.selection = [];
        this.closeMetadata();
        this.createAllowed = false;
        this.actionOptions = this.getOptions(null, false);
        if (!id) {
            this.path = [];
            id = this.getRootFolderId();
            if (this.root === 'RECYCLE') {
                // GlobalContainerComponent.finishPreloading();
                // return;
            }
        }
        else {
            this.selectedNodeTree = id;
            this.node.getNodeParents(id).subscribe((data: NodeList) => {
                if (this.root === 'RECYCLE') {
                    this.path = [];
                }
                else {
                    this.path = data.nodes.reverse();
                }
                this.selectedNodeTree = null;
            }, (error: any) => {
                this.selectedNodeTree = null;
                this.path = [];
            });
        }
        this.currentFolder = null;
        this.allowBinary = true;
        const root = !id || WorkspaceMainComponent.VALID_ROOTS_NODES.indexOf(id) !== -1;
        if (!root) {
            this.isRootFolder = false;
            console.log('open path: ' + id);
            this.node.getNodeMetadata(id).subscribe((data: NodeWrapper) => {
                this.mds.getSet(data.node.metadataset ? data.node.metadataset : RestConstants.DEFAULT).subscribe((mds: any) => {
                    if (mds.create) {
                        this.allowBinary = !mds.create.onlyMetadata;
                        if (!this.allowBinary) {
                            console.log('mds does not allow binary files, will switch mode');
                        }
                    }
                });
                this.updateNodeByParams(params, data.node);
                this.createAllowed = !this.searchQuery && NodeHelper.getNodesRight([data.node], RestConstants.ACCESS_ADD_CHILDREN);
                this.actionOptions = this.getOptions(this.selection, false);
                this.recoverScrollposition();
            }, (error: any) => {
                this.updateNodeByParams(params, { ref: { id } });
            });
        }
        else {
            this.isRootFolder = true;
            console.log('open root path ' + id);
            if (id === RestConstants.USERHOME) {
                this.createAllowed = true;
            }
            this.updateNodeByParams(params, { ref: { id }, name: this.translate.instant('WORKSPACE.' + this.root) });
        }

    }
    public createEmptyNode() {
        this.globalProgress = true;
        const prop = RestHelper.createNameProperty(DateHelper.formatDateByPattern(new Date().getTime(), 'y-M-d'));
        this.node.createNode(this.currentFolder.ref.id, RestConstants.CCM_TYPE_IO, [], prop, true, RestConstants.COMMENT_MAIN_FILE_UPLOAD)
            .subscribe((data: NodeWrapper) => {
                this.editNodeMetadata = data.node;
                this.editNodeDeleteOnCancel = true;
                this.globalProgress = false;
            });
    }
    private openNode(node: Node, useConnector = true) {
        if (!node.isDirectory) {
            if (NodeHelper.isSavedSearchObject(node)) {
                UIHelper.routeToSearchNode(this.router, null, node);
            }
            else if (RestToolService.isLtiObject(node)) {
                this.toolService.openLtiObject(node);
            }
            else if (useConnector && this.connectors.connectorSupportsEdit(node)) {
                this.editConnector(node);
            }
            else {
                this.displayNode(node);
            }
            return;
        }
        this.openDirectory(node.ref.id);
    }
    private openBreadcrumb(position: number) {
        /*this.path=this.path.slice(0,position+1);
        */
        this.searchQuery = null;
        this.actionOptions = null;
        let id = '';
        const length = this.path ? this.path.length : 0;
        if (position > 0) {
            id = this.path[position - 1].ref.id;
        }
        else if (length > 0) {
            id = null;
        }
        else {
            if(UIHelper.evaluateMediaQuery(UIConstants.MEDIA_QUERY_MAX_WIDTH,UIConstants.MOBILE_TAB_SWITCH_WIDTH)) {
                this.showSelectRoot = true;
            }
            return;
        }
        console.log('breadcrumb ' + position + ' ' + id);

        this.openDirectory(id);
    }
    private refresh(refreshPath = true) {
        const search = this.searchQuery;
        const folder = this.currentFolder;
        this.currentFolder = null;
        this.searchQuery = null;
        this.selection = [];
        this.actionOptions = this.getOptions(this.selection, false);
        const path = this.path;
        if (refreshPath) {
            this.path = [];
        }
        setTimeout(() => {
            this.path = path;
            this.currentFolder = folder;
            this.searchQuery = search;
        });
    }

    private doRestoreVersion(version: Version): void {
        this.hideDialog();
        this.globalProgress = true;
        this.node.revertNodeToVersion(version.version.node.id, version.version.major, version.version.minor)
            .subscribe(
                (data: NodeVersions) => {
                    this.globalProgress = false;
                    this.refresh();
                    this.closeMetadata();
                    this.openMetadata(version.version.node.id);
                    this.toast.toast('WORKSPACE.REVERTED_VERSION');
                },
                (error: any) => this.toast.error(error));
    }

    private refreshRoute() {
        this.routeTo(
            this.root,
            !this.isRootFolder && this.currentFolder ? this.currentFolder.ref.id : null,
            this.searchQuery ? this.searchQuery.query : null
        );
    }
    private routeTo(root: string, node: string = null, search: string = null) {
        const params: any = { root, id: node, viewType: this.viewType, query: search, mainnav: this.mainnav };
        if (this.reurl) {
            params.reurl = this.reurl;
        }
        if (this.reurlDirectories) {
            params.applyDirectories = this.reurlDirectories;
        }
        this.router.navigate(['./'], { queryParams: params, relativeTo: this.route })
            .then((result: boolean) => {
                if (!result) {
                    this.refresh(false);
                }
            });
    }

    private showAlpha() {
        this.toast.showModalDialog('WORKSPACE.ALPHA_TITLE',
            'WORKSPACE.ALPHA_MESSAGE',
            DialogButton.getOk(() => this.hideDialog()),
            false
        );
    }

    private nodeTemplate(node: Node) {
        this.editNodeTemplate = this.getNodeList(node)[0];
    }
    private addToCollection(node: Node) {
        const nodes = this.getNodeList(node);
        this.addNodesToCollection = nodes;
    }
    private addToStream(node: Node) {
        const nodes = this.getNodeList(node);
        this.addNodesStream = nodes;
    }
    private createVariant(node: Node) {
        const nodes = this.getNodeList(node);
        this.variantNode = nodes[0];
    }
    private createContext(event: any = null) {
        if (!this.createAllowed) {
            return;
        }
        console.log(this.dropdownTrigger);
        this.dropdownTrigger.openMenu();
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
    }

    private goToLogin() {
        RestHelper.goToLogin(this.router, this.config, this.isSafe ? RestConstants.SAFE_SCOPE : '');
    }

    private getRootFolderId() {
        if (this.root === 'MY_FILES') {
            return RestConstants.USERHOME;
        }
        if (this.root === 'SHARED_FILES') {
            return RestConstants.SHARED_FILES;
        }
        if (this.root === 'MY_SHARED_FILES') {
            return RestConstants.MY_SHARED_FILES;
        }
        if (this.root === 'TO_ME_SHARED_FILES') {
            return RestConstants.TO_ME_SHARED_FILES;
        }
        if (this.root === 'WORKFLOW_RECEIVE') {
            return RestConstants.WORKFLOW_RECEIVE;
        }
        return '';
    }

    private toggleView() {
        this.viewType = 1 - this.viewType;
        this.refreshRoute();
        if (this.viewType === 0) {
            this.viewToggle.icon = 'view_module';
        }
        else {
            this.viewToggle.icon = 'list';
        }

    }

    public listLTI() {
        this.showLtiTools = true;
    }

    hasOpenWindows() {
        return this.editNodeLicense
            || this.nodeDebug
            || this.editNodeTemplate
            || this.editNodeMetadata
            || this.createConnectorName
            || this.showUploadSelect
            || this.toast.isModalDialogOpen()
            || this.addFolderName
            || this.sharedNode
            || this.workflowNode
            || this.filesToUpload;
    }
    private recoverScrollposition() {
        console.log('recover scroll ' + this.storage.get('workspace_scroll', 0));
        window.scrollTo(0, this.storage.get('workspace_scroll', 0));
    }

    private applyNode(node: Node, force = false) {
        /*if(node.isDirectory && !force){
            this.dialogTitle='WORKSPACE.APPLY_NODE.DIRECTORY_TITLE';
            this.dialogCancelable=true;
            this.dialogMessage='WORKSPACE.APPLY_NODE.DIRECTORY_MESSAGE';
            this.dialogMessageParameters={name:node.name};
            this.dialogButtons=DialogButton.getYesNo(()=>{
                this.dialogTitle=null;
            },()=>{
                this.dialogTitle=null;
                this.applyNode(node,true);
            });
            return;
        }*/
        NodeHelper.addNodeToLms(this.router, this.storage, node, this.reurl);
    }

    private updateNodeByParams(params: any, node: Node | any) {
        GlobalContainerComponent.finishPreloading();
        if (params.query) {
            this.doSearchFromRoute(params, node);
        }
        else {
            this.searchQuery = null;
            this.currentFolder = node;
            this.event.broadcastEvent(FrameEventsService.EVENT_NODE_FOLDER_OPENED, this.currentFolder);
        }
    }

    private canPasteInCurrentLocation() {
        const clip = (this.storage.get('workspace_clipboard') as ClipboardObject);
        return this.currentFolder
            && !this.searchQuery
            && clip
            && ((!clip.sourceNode || clip.sourceNode.ref.id !== this.currentFolder.ref.id) || clip.copy)
            && this.createAllowed;
    }
}
