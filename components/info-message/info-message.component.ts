import {Component, Input} from "@angular/core";
import {ListItem} from "../../../core-module/ui/list-item";
import {RestConstants} from "../../../core-module/rest/rest-constants";

@Component({
    selector: 'info-message',
    templateUrl: 'info-message.component.html',
    styleUrls: ['info-message.component.scss']
})
export class InfoMessageComponent {
    /**
     * the message to display
     */
    @Input() message:string;
    @Input() mode: 'info' | 'warning' = 'info';

    ICONS:any={
        info:'info_outline',
        warning:'warning_outline',
    };
    constructor() {
    }
    getIcon(){
        return this.ICONS[this.mode];
    }
}
