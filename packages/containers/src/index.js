// Containers hold the components of the application. Each one uses a shadow root with slots, so
// the children stay the children of the application. The design and each option are in the README.
import { defineElements } from "@catalystcommunity/base-components";
import { GroupBox } from "./group-box.js";
import { TabView, TabPage } from "./tab-view.js";
import { SplitView } from "./split-view.js";
import { AccordionView, AccordionSection } from "./accordion-view.js";
import { ScrollArea, StatusBar, StatusPane, FormLayout, BoxLayout } from "./layouts.js";
import { DialogWindow, showMessage, askConfirm, askText } from "./dialog-window.js";
import { WindowArea, FloatingWindow } from "./window-area.js";

// The default tag of each container
const containerTags = {
    'group-box': GroupBox,
    'tab-view': TabView,
    'tab-page': TabPage,
    'split-view': SplitView,
    'accordion-view': AccordionView,
    'accordion-section': AccordionSection,
    'scroll-area': ScrollArea,
    'status-bar': StatusBar,
    'status-pane': StatusPane,
    'form-layout': FormLayout,
    'box-layout': BoxLayout,
    'dialog-window': DialogWindow,
    'window-area': WindowArea,
    'floating-window': FloatingWindow,
};

// Defines each default tag that is not defined yet. Importing the package defines nothing.
function defineContainers(tags = containerTags) {
    defineElements(tags);
}

export {
    GroupBox, TabView, TabPage, SplitView, AccordionView, AccordionSection,
    ScrollArea, StatusBar, StatusPane, FormLayout, BoxLayout,
    DialogWindow, showMessage, askConfirm, askText,
    WindowArea, FloatingWindow,
    containerTags, defineContainers,
};
