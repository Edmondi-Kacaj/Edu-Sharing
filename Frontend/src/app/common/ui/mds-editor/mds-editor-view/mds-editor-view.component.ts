import {
    AfterViewInit,
    Component,
    ComponentFactoryResolver,
    ElementRef,
    Input,
    OnInit,
    Type,
    ViewChild,
    ViewContainerRef,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Node, View } from '../../../../core-module/core.module';
import { UIHelper } from '../../../../core-ui-module/ui-helper';
import { MdsEditorInstanceService, Widget } from '../mds-editor-instance.service';
import {Constraints, MdsEditorWidgetComponent, MdsWidgetType, NativeWidgetType, Values} from '../types';
import { MdsEditorWidgetChipsComponent } from '../widgets/mds-editor-widget-chips/mds-editor-widget-chips.component';
import { MdsEditorWidgetErrorComponent } from '../widgets/mds-editor-widget-error/mds-editor-widget-error.component';
import { MdsEditorWidgetLinkComponent } from '../widgets/mds-editor-widget-link/mds-editor-widget-link.component';
import { MdsEditorWidgetPreviewComponent } from '../widgets/mds-editor-widget-preview/mds-editor-widget-preview.component';
import { MdsEditorWidgetTextComponent } from '../widgets/mds-editor-widget-text/mds-editor-widget-text.component';
import { MdsEditorWidgetTreeComponent } from '../widgets/mds-editor-widget-tree/mds-editor-widget-tree.component';
import { MdsEditorWidgetVersionComponent } from '../widgets/mds-editor-widget-version/mds-editor-widget-version.component';
import { MdsEditorWidgetSelectComponent } from '../widgets/mds-editor-widget-select/mds-editor-widget-select.component';
import { MdsEditorWidgetSliderComponent } from '../widgets/mds-editor-widget-slider/mds-editor-widget-slider.component';
import {MdsEditorWidgetAuthorComponent} from '../widgets/mds-editor-widget-author/mds-editor-widget-author.component';
import {BehaviorSubject} from 'rxjs';

export interface NativeWidget {
    hasChanges: BehaviorSubject<boolean>;
    onSaveNode?: (nodes: Node[]) => Promise<Node[]>;
    getValues?: (node: Node, values: Values) => Values;
}
type NativeWidgetClass = {
    constraints: Constraints;
} & Type<NativeWidget>;

@Component({
    selector: 'app-mds-editor-view',
    templateUrl: './mds-editor-view.component.html',
    styleUrls: ['./mds-editor-view.component.scss'],
})
export class MdsEditorViewComponent implements OnInit, AfterViewInit {
    private static readonly nativeWidgets: {
        [widgetType in NativeWidgetType]: NativeWidgetClass;
    } = {
        preview: MdsEditorWidgetPreviewComponent,
        author: MdsEditorWidgetAuthorComponent,
        version: MdsEditorWidgetVersionComponent,
        childobjects: null as null,
        template: MdsEditorWidgetLinkComponent,
        license: MdsEditorWidgetLinkComponent,
        workflow: null as null,
    };
    private static readonly widgetComponents: {
        [type in MdsWidgetType]: MdsEditorWidgetComponent;
    } = {
        [MdsWidgetType.Text]: MdsEditorWidgetTextComponent,
        [MdsWidgetType.Number]: MdsEditorWidgetTextComponent,
        [MdsWidgetType.Email]: MdsEditorWidgetTextComponent,
        [MdsWidgetType.Date]: MdsEditorWidgetTextComponent,
        [MdsWidgetType.Month]: MdsEditorWidgetTextComponent,
        [MdsWidgetType.Color]: MdsEditorWidgetTextComponent,
        [MdsWidgetType.Textarea]: MdsEditorWidgetTextComponent,
        [MdsWidgetType.MultiValueBadges]: MdsEditorWidgetChipsComponent,
        [MdsWidgetType.MultiValueSuggestBadges]: MdsEditorWidgetChipsComponent,
        [MdsWidgetType.MultiValueFixedBadges]: MdsEditorWidgetChipsComponent,
        [MdsWidgetType.Singleoption]: MdsEditorWidgetSelectComponent,
        [MdsWidgetType.Slider]: MdsEditorWidgetSliderComponent,
        [MdsWidgetType.Range]: MdsEditorWidgetSliderComponent,
        [MdsWidgetType.MultiValueTree]: MdsEditorWidgetTreeComponent,
    };

    @ViewChild('container') container: ElementRef<HTMLDivElement>;
    @Input() view: View;
    html: SafeHtml;

    constructor(
        private sanitizer: DomSanitizer,
        private factoryResolver: ComponentFactoryResolver,
        private containerRef: ViewContainerRef,
        private mdsEditorInstance: MdsEditorInstanceService,
    ) {}

    ngOnInit(): void {
        this.html = this.getHtml();
    }

    ngAfterViewInit(): void {
        // Wait for the change-detection cycle to finish.
        setTimeout(() => this.injectWidgets());
    }

    private getHtml(): SafeHtml {
        const html = closeTags(this.view.html, [
            ...Object.values(NativeWidgetType),
            ...this.mdsEditorInstance.mdsDefinition.widgets.map((w) => w.id),
        ]);
        return this.sanitizer.bypassSecurityTrustHtml(html);
    }

    private injectWidgets(): void {
        const elements = this.container.nativeElement.getElementsByTagName('*');
        for (const element of Array.from(elements)) {
            const tagName = element.localName;
            if (Object.values(NativeWidgetType).includes(tagName as NativeWidgetType)) {
                const widgetName = tagName as NativeWidgetType;
                this.mdsEditorInstance.registerNativeWidget(this.injectNativeWidget(widgetName, element).instance);
                continue;
            }
            const widget = this.mdsEditorInstance.getWidget(tagName);
            if (widget) {
                this.injectWidget(widget, element);
            }
        }
    }

    private injectNativeWidget(widgetName: NativeWidgetType, element: Element) {
        const WidgetComponent = MdsEditorViewComponent.nativeWidgets[widgetName];
        if (!WidgetComponent) {
            UIHelper.injectAngularComponent(
                this.factoryResolver,
                this.containerRef,
                MdsEditorWidgetErrorComponent,
                element,
                {
                    widgetName,
                    reason: 'Not implemented',
                },
            );
            return null;
        }
        const constraintViolation = this.violatesConstraints(WidgetComponent.constraints);
        if (constraintViolation) {
            UIHelper.injectAngularComponent(
                this.factoryResolver,
                this.containerRef,
                MdsEditorWidgetErrorComponent,
                element,
                {
                    widgetName,
                    reason: constraintViolation,
                },
            );
            return null;
        }
        return UIHelper.injectAngularComponent(
            this.factoryResolver,
            this.containerRef,
            WidgetComponent,
            element,
            {
                widgetName,
            },
        );
    }

    private injectWidget(widget: Widget, element: Element): void {
        const WidgetComponent = MdsEditorViewComponent.widgetComponents[widget.definition.type];
        if (!WidgetComponent) {
            UIHelper.injectAngularComponent(
                this.factoryResolver,
                this.containerRef,
                MdsEditorWidgetErrorComponent,
                element,
                {
                    widgetName: widget.definition.caption,
                    reason: `Widget for type ${widget.definition.type} is not implemented`,
                },
            );
            return;
        }
        // override widget definition using inline parameters
        const htmlRef = this.updateWidgetWithHTMLAttributes(widget);
        UIHelper.injectAngularComponent(
            this.factoryResolver,
            this.containerRef,
            WidgetComponent,
            element,
            {
                widget,
            },
        );
    }

    private updateWidgetWithHTMLAttributes(widget: Widget) {
        const htmlRef = this.container.nativeElement.querySelector(widget.definition.id.replace(':', '\\:'));
        htmlRef?.getAttributeNames().forEach((attribute) => {
            widget.definition[attribute] = htmlRef.getAttribute(attribute);
        });
    }

    private violatesConstraints(constraints: Constraints): string | null {
        if (constraints.requiresNode === true) {
            if (!this.mdsEditorInstance.nodes.value) {
                return 'Only supported if a node object is available';
            }
        }
        if (constraints.supportsBulk === false) {
            if (this.mdsEditorInstance.isBulk) {
                return 'Not supported in bulk mode';
            }
        }
        return null;
    }
}

function closeTags(html: string, tags: string[]): string {
    for (const tag of tags) {
        const start = html.indexOf('<' + tag);
        if (start === -1) {
            continue;
        }
        const end = html.indexOf('>', start) + 1;
        html = html.substring(0, end) + '</' + tag + '>' + html.substring(end);
    }
    return html;
}
