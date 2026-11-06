// Example pages that use many components together. Each one has a route: /examples/<id>.
import {renderScaleLab} from './scale-lab.js';
import {renderSpreadsheetExample} from './spreadsheet.js';
import {renderDesktopExample} from './desktop.js';
import {exampleList} from './list.js';

const renderers = {desktop: renderDesktopExample, spreadsheet: renderSpreadsheetExample, 'scale-lab': renderScaleLab};

export const examples = exampleList.map(item => ({...item, render: renderers[item.id]}));
