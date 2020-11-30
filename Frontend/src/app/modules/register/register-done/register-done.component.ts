import {Component, EventEmitter, Input, Output} from '@angular/core';
import {RestConnectorService} from "../../../common/rest/services/rest-connector.service";
import {Toast} from "../../../common/ui/toast";
import {PlatformLocation} from "@angular/common";
import {ActivatedRoute, Router, UrlSerializer} from "@angular/router";
import {TranslateService} from "@ngx-translate/core";
import {ConfigurationService} from "../../../common/services/configuration.service";
import {Title} from "@angular/platform-browser";
import {SessionStorageService} from "../../../common/services/session-storage.service";
import {UIConstants} from "../../../common/ui/ui-constants";
import {RestRegisterService} from '../../../common/rest/services/rest-register.service';
import {UIHelper} from "../../../common/ui/ui-helper";
import {CordovaService} from "../../../common/services/cordova.service";
import {RestLocatorService} from "../../../common/rest/services/rest-locator.service";

@Component({
  selector: 'app-register-done',
  templateUrl: 'register-done.component.html',
  styleUrls: ['register-done.component.scss']
})
export class RegisterDoneComponent{
    @Output() onModify = new EventEmitter();
    @Input() inputState:string;
    loading=false;
    email = '';
    keyInput = '';
    private _keyUrl = '';
    private static STATUS_INTERVAL = 5000;
    private activated = false;
    get keyUrl(){
        return this._keyUrl;
    }
    set keyUrl(keyUrl:string){
        this._keyUrl=keyUrl;
        this.loading=true;
        this.activate(keyUrl);
    }

    public editMail() {
        this.onModify.emit();
    }
    public sendMail(){
        this.loading=true;
        if(this.inputState=='done') {
            this.register.resendMail(this.email).subscribe(() => {
                this.toast.toast("REGISTER.TOAST");
                this.loading=false;
            },(error)=>{
                this.loading=false;
            });
        }
        else{
            this.register.recoverPassword(this.email).subscribe(()=>{
                this.loading=false;
            },(error)=>{
                this.loading=false;
            });
        }
    }
    constructor(private connector: RestConnectorService,
                private toast: Toast,
                private register: RestRegisterService,
                private platformLocation: PlatformLocation,
                private config: ConfigurationService,
                private cordova: CordovaService,
                private locator: RestLocatorService,
                private router: Router
    ) {
        setTimeout(()=>this.checkStatus(),RegisterDoneComponent.STATUS_INTERVAL);
    }

    // loop and check if the user has already registered in an other tab
    private checkStatus() {
        if(this.activated){
            return;
        }
        if(this.inputState!='done') {
            setTimeout(()=>this.checkStatus(),RegisterDoneComponent.STATUS_INTERVAL);
            return;
        }
        this.register.exists(this.email).subscribe((status)=>{
            if(status.exists){
                this.router.navigate([UIConstants.ROUTER_PREFIX,"login"],{queryParams:{"username":this.email}});
                return;
            }
            setTimeout(()=>this.checkStatus(),RegisterDoneComponent.STATUS_INTERVAL);
        },(error)=>{
            setTimeout(()=>this.checkStatus(),RegisterDoneComponent.STATUS_INTERVAL);
        });
    }
    activate(keyUrl: string) {
        this.loading=true;
        if(this.inputState=='done') {
            this.register.activate(keyUrl).subscribe(() => {
                this.activated = true;
                if(this.cordova.isRunningCordova()){
                    this.locator.createOAuthFromSession().subscribe(()=>{
                        UIHelper.goToDefaultLocation(this.router, this.platformLocation, this.config);
                    },(error)=>{
                        this.toast.error(error);
                    });
                }
                else {
                    UIHelper.goToDefaultLocation(this.router, this.platformLocation, this.config);
                }
            }, (error) => {
                if (UIHelper.errorContains(error, "InvalidKeyException")) {
                    this.toast.error(null, "REGISTER.TOAST_INVALID_KEY");
                }
                else {
                    this.toast.error(error);
                }
                this.loading = false;
            });
        }
        else{
            this.router.navigate([UIConstants.ROUTER_PREFIX,"register","reset-password",this.keyInput]);
        }
    }
}
