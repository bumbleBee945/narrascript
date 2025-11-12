/*

Narrascript Editor File (./public/editor.js)
Last updated 11/12/25 by Avery Olsen

Editor JavaScript file; Handles all editor logic, parsing, JSON handling

*/

const TEMPLATE = {
  main: {
    player: {
      '@room': 'room_template',
      '@inventory': '',
      '@invalid': 'That command is not valid.'
    },
    global: {
      '@effects': ''
    },
    rooms: {
        room_template: {
            '@body': 'You enter the template room.'
        }
    },
    commands: {
        example: {
            '@effects': 'display(Hello world!);'
        }
    }
  }
};

let project = null;
let objPanel;
let fileInput;
const viewSlots = Array.from(
    { length: 4 }, () => (
        { path: null, field: null, label: null, dirty: false }));
let objectTree = [];
const collapsed = new Set();
const LAYOUTS = [
    { id: '1',   label: '1',   slots: 1 },
    { id: '1x1', label: '1:1', slots: 2 },
    { id: '2x1', label: '2:1', slots: 3 },
    { id: '2x2', label: '2:2', slots: 4 },
];
let currentLayout = {
    layoutId: '2x2',
    isVertical: false,
    isReverse: false
};

const [
    layoutMenu, layoutOptions,
    verticalLabel, verticalCheckbox,
    reverseLabel, reverseCheckbox
      ] = layoutEls();

let isLayoutMenuOpen  = false;

moduleInit();
handleNew();
function layoutEls() {
    const queries = [];
    const menu = document.querySelector('.layout-menu')
    queries.push(menu);
    queries.push(menu.querySelector('.layout-options'));
    queries.push(menu.querySelector('[data-option="vertical"]'));
    queries.push(menu.querySelector('[data-option-input="vertical"]'));
    queries.push(menu.querySelector('[data-option="reverse"]'));    
    queries.push(menu.querySelector('[data-option-input="reverse"]'));
    return queries;
}
function moduleInit() {
    objPanel = document.querySelector('.object-panel');
    loadProjectState(TEMPLATE);
    fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json,application/json';
    fileInput.hidden = true;
    document.body.appendChild(fileInput);

    const btnChangePanels = document.querySelector('[data-action="change-panels"]');
    const btnNew = document.querySelector('[data-action="new"]');
    const btnDownload = document.querySelector('[data-action="download"]');
    const btnLoad = document.querySelector('[data-action="load"]');
    const btnObjectToggle = document.querySelector('[data-action="toggle-objects"]');
    
    verticalCheckbox.addEventListener('change', () => {
        if (verticalLabel.style.display === 'inline-flex') {
            currentLayout.isVertical = verticalCheckbox.checked;
            applyCurrentLayout();
        }
    });

    reverseCheckbox.addEventListener('change', () => {
        if (reverseLabel.style.display === 'inline-flex') {
            currentLayout.isReverse = reverseCheckbox.checked;
            applyCurrentLayout();
        }
    });


    const slotWrappers = Array.from(
            document.querySelectorAll('[data-editor-slot]'));
    const fieldAreas  = slotWrappers.map(wrapper =>
        wrapper.querySelector('textarea'));
    const fieldErrors  = fieldAreas.map(area =>
        area.closest('.field').querySelector('.field-error'));
    const fieldLabels = fieldAreas.map(area =>
        area.closest('.field').querySelector('.field-label'));

    fieldAreas.forEach((area, idx) => {
        const slot = viewSlots[idx];
        slot.field = area;
        slot.label = fieldLabels[idx];
        slot.error = fieldErrors[idx];
        updateTools(slot);

        area.addEventListener('keydown', (event) => {
            if (event.key !== 'Tab') return;
            event.preventDefault();

            const start = area.selectionStart;
            const end = area.selectionEnd;
            area.setRangeText('  ', start, end, 'end'); // two spaces
        });
    });

    slotWrappers.forEach((wrapper, idx) => {
        wrapper.addEventListener('click', (event) => {
            const button = event.target.closest('[data-slot-action]');
            if (!button || !wrapper.contains(button)) return;
            event.preventDefault();
            event.stopPropagation();
            handleSlotAction(button.dataset.slotAction, idx);
        });
    });

    document.addEventListener('click', (event) => {
        if (!isLayoutMenuOpen) return;
        if (!layoutMenu.contains(event.target)) {
            closeLayoutMenu(); }

    });
    btnChangePanels.addEventListener('click', (event) => {
        event.stopPropagation();
        handleChangePanels();
    });
    btnNew.addEventListener('click', handleNew);
    btnDownload.addEventListener('click', handleDownload);
    btnLoad.addEventListener('click', handleLoad);
    //btnDocs.addEventListener('click', () => window.open(DOCS_URL)); // TODO

    btnObjectToggle.addEventListener('click', () => {
        objPanel.hidden = !objPanel.hidden;
        if (!objPanel.hidden) {
            collapsed.clear();
            objectTree.forEach(node => {
                if (node.childCount > 1) collapsed.add(node.path);
            });
            btnObjectToggle.textContent = 'Objects ↓';
            renderObjectList();
        } else {
            btnObjectToggle.textContent = 'Objects ↑';
        }
    });

    objPanel.addEventListener('click', (event) => {
        const btnAction = event.target.closest('[data-path]');
        if (!btnAction) return;
        const path = btnAction.dataset.path;
        const action = btnAction.dataset.action;

        if (action === 'add') {
            handleAddChild(path);
            return;
        }
        if (action === 'remove') {
            handleRemoveNode(path);
            return;
        }
        if (action === 'rename') {
            handleRenameNode(path);
            return;
        }

        // default: view
        const slot = findAvailableSlot(); // decide which field to use
        renderViewSlot(slot, path);
    });

    viewSlots.forEach((slot, idx) => {
        slot.field.addEventListener('input', () => handleFieldInput(idx));
    });


    applyCurrentLayout();
}
function updateLabel(slot) {
    if (!slot.label) return;
    if (slot.path === null) {
        slot.label.textContent = '-'; return;
    }

    const segments = slot.path.split('/');
    const parent = (segments.length > 2 ? segments[1] : segments[0])
    const suffix = (parent === 'main') ? '' : (' ('+parent.slice(0, -1)+')');
    const star = slot.dirty ? ' *' : '';
    slot.label.textContent = segments[segments.length - 1] + star + suffix;
}
function loadProjectState(source) {
    project = JSON.parse(JSON.stringify(source)); // simple deep clone
    //clear view slots
    viewSlots.forEach(slot => {
        slot.path = null;
        slot.dirty = false;
        updateLabel(slot);
        if (slot.field) {
            slot.field.value = '';
            slot.field.classList.remove('has-error');
        }
    });
    // build cached object tree
    objectTree = buildObjectTree(project);
    if (!objPanel.hidden) renderObjectList();
    
    renderViewSlot(0, 'main/player');
}
function renderViewSlot(index, path) {
    const slot = viewSlots[index];
    if (!slot.field || !slot.label) return;

    // get data
    const data = getObjectByPath(project, path);
    if (data === undefined) { // no data, return error
        slot.label.textContent = `${path} (not found)`;
        slot.field.value = '';
        slot.path = null;
        return;
    }

    // update slot data
    slot.path = path;

    // update label
    updateLabel(slot);
    updateTools(slot);

    // fill field
    slot.field.value = formatObjectForField(data);

    // clear errors
    slot.field.classList.remove('has-error');
}
function updateTools(slot) {
    const wrapper = slot.field.closest('[data-editor-slot]');
    const btnClear = wrapper.querySelector('[data-slot-action="clear"]');
    const btnRename = wrapper.querySelector('[data-slot-action="rename"]');
    const btnChild = wrapper.querySelector('[data-slot-action="add-child"]');
    let [disClear, disRename, disChild] = ['', '', ''];
    
    if (!slot.path) { disClear = 'none'; disRename = 'none'; }
    else if (slot.path.split('/').length <= 2) disRename = 'none';
    if (!canAddChild(slot.path)) disChild = 'none';

    btnClear.style.display = disClear;
    btnRename.style.display = disRename;
    btnChild.style.display = disChild;
}
function getObjectByPath(root, path) {
    const pathParts = path.split('/');
    let cursor = root;
    for (const key of pathParts) {
        if (cursor == null || typeof cursor !== 'object' || !(key in cursor))
            return undefined;
        cursor = cursor[key];
    }
    return cursor;
}
function setObjectByPath(root, path, newValue) {
    const pathParts = path.split('/');
    let cursor = root;
    for (let i = 0; i < pathParts.length - 1; i++) {
        const key = pathParts[i];
        if (cursor == null || typeof cursor !== 'object' || !(key in cursor))
            return undefined;
        cursor = cursor[key];
    }

    const lastKey = pathParts[pathParts.length - 1];
    cursor[lastKey] = newValue;
}
function formatObjectForField(value) {
    if (value === null || typeof value !== 'object')
        return stringifyValue(value);
    const lines = Object.entries(value).map(([key, val]) => {
        const passed = (typeof val === 'string'
                ? beautifyProperty(val) : val);
        return `"${key}": ${stringifyValue(passed)}`
    });
    return lines.join(',\n\n');
}
function beautifyProperty(text) {
    if (text === '') return '\n';
    const lines = text
    .replace(/;/g, ';\n')
    .replace(/\{/g, '{\n')
    .replace(/\}/g, '\n}')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

    let indent = 1;
    const result = [];
    
    lines.forEach(line => {
        if (line.endsWith('}')) indent--;
        result.push('  '.repeat(Math.max(indent, 0)) + line);
        if (line.endsWith('{')) indent++;
    });

    return '\n'+result.join('\n')+'\n';
}
function escapeMultilineStrings(source) {
    let result = '';
    let inString = false;
    let escaped = false;
    for (let i = 0; i < source.length; i++) {
        const char = source[i];

             if (!inString && char === '"') inString = true;
        else if (escaped)                   escaped = false;
        else if (char === '\\')             escaped = true;
        else if (char === '"')              inString = false;
        else if (char === '\n' && inString){result += '\\n'; continue;}

        result += char;
    }
    return result;
}
function stringifyValue(val) {
    if (typeof val === 'string') {
        return `"${val
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')}"`;
    }
    return JSON.stringify(val);
}
function buildObjectTree(root) {
    const result = [];

    // make walker
    function walk(node, pathParts, depth) {
        // keys array containing objects
        const keys = Object.keys(node)
                .filter(key => node[key] && typeof node[key] === 'object');
        // per key logic
        keys.forEach((key) => {
            const child = node[key];
            const childrenAmt = Object.keys(child).filter(
                innerKey => child[innerKey] && typeof child[innerKey] === 'object').length
            const newPath = [...pathParts, key];
            
            // add object to result
            result.push({
                path: newPath.join('/'),
                name: key,
                depth,
                hasChildren: childrenAmt > 0,
                childCount: childrenAmt
            });

            // recurse if child is an object
            walk(child, newPath, depth + 1);
        });

    }

    walk(root.main, ['main'], 0);
    return result;
}
function renderObjectList() {
    const listEl = objPanel.querySelector('[data-object-list]');
    listEl.innerHTML = '';
    objectTree.forEach(node => {
        const { path, name, depth, hasChildren, childCount } = node;

        //dont render if parent is collapsed
        const parentPath = path.split('/').slice(0, -1).join('/');
        if (parentPath && collapsed.has(parentPath)) return;

        const item = document.createElement('div');
        item.className = 'object-item';
        let padding = node.depth + 0.35;
        if (!hasChildren) padding -= 1;
        item.style.paddingLeft = `${padding}rem`; //indent

        item.addEventListener('click', (event) => {
            const target = event.target;
            if (target.closest('button')) return;

            if (hasChildren) {
                if (collapsed.has(path)) collapsed.delete(path);
                else collapsed.add(path);
                renderObjectList();
            } else {
                const slot = findAvailableSlot();
                renderViewSlot(slot, path);
            }
        });

        if (hasChildren) {
            const btnToggle = document.createElement('button');
            btnToggle.type = 'button';
            btnToggle.className = 'collapse-toggle';
            btnToggle.textContent = collapsed.has(path) ? '→ ' : '↓ ';
            btnToggle.addEventListener('click', () => {
                if (collapsed.has(path)) collapsed.delete(path);
                else collapsed.add(path);
                renderObjectList();
            });
            item.appendChild(btnToggle);
        } else {
            const spacer = document.createElement('span');
            spacer.className = 'collapse-spacer';
            item.appendChild(spacer);
        }

        const label = document.createElement('span');
        label.className = 'object-name';
        const prefix = (hasChildren ? '' :
                (name === 'global' || name === 'player') ? '' : '↳ ');
        label.textContent = prefix+name;
        item.appendChild(label);

        if (!hasChildren) {
            const btnView = document.createElement('button');
            btnView.type = 'button';
            btnView.className = 'object-view';
            btnView.dataset.path = path;
            btnView.textContent = 'View';
            item.appendChild(btnView);
        }

        if (canAddChild(node.path)) {
            const btnAddNew = document.createElement('button');
            btnAddNew.type = 'button';
            btnAddNew.className = 'object-add';
            btnAddNew.textContent = (path.split('/').length === 2 ?
                                    '+ New' : '+ Child');
            btnAddNew.dataset.action = 'add';
            btnAddNew.dataset.path = node.path;
            item.append(btnAddNew);
        }

        if (canRemoveNode(node)) {
            const btnRemove = document.createElement('button');
            btnRemove.type = 'button';
            btnRemove.className = 'object-remove';
            btnRemove.textContent = '- Remove';
            btnRemove.dataset.action = 'remove';
            btnRemove.dataset.path = node.path;
            item.append(btnRemove);
        }

        if (canRenameNode(node)) {
            const btnRename = document.createElement('button');
            btnRename.type = 'button';
            btnRename.className = 'object-rename';
            btnRename.textContent = '? Rename';
            btnRename.dataset.action = 'rename';
            btnRename.dataset.path = node.path;
            item.append(btnRename);
        }

        listEl.appendChild(item);
    });
}
function canAddChild(path) {
    if (!path) return false;
    return !(path === 'main/player' || path === 'main/global');
}
function canRemoveNode(node) {
  const segments = node.path.split('/');
  const isTopLevel = segments.length <= 2; // e.g., main/rooms
  const hasChildren = node.childCount > 0; // childCount from buildObjectTree
  const canRemove = !(isTopLevel || hasChildren);

  return canRemove;
}
function canRenameNode(node) {
    return !(node.path.split('/').length <= 2);
}
function isInvalidObjName(name) {
    let result = '';

    if (!name) result = "no name given";
    if (name.includes(' ')) result = "includes spaces";
    if (name.includes('/') || name.includes('\\')) result = "includes slashes";
    
    if (result !== '') {
        result = "Invalid name:\n("+result+")";
    }

    return result;
}
function handleAddChild(parentPath) {
    if (!canAddChild(parentPath)) return;

    const parentObj = getObjectByPath(project, parentPath);
    if (!parentObj || typeof parentObj !== 'object') return;

    let template = getTemplateByType(parentPath);
    if (!template) {
        alert('Cannot add a child for this object.');
        return;
    }

    if (hasNonEmptyValue(parentObj)) {
        const ok = confirm(`Parents cannot have properties.\nParent properties will be moved to child.\nProceed?`);
        if (!ok) return;
        
        template = { ...parentObj };
        Object.keys(parentObj).forEach(k => {
            if (typeof parentObj[k] === 'string')
            delete parentObj[k];
        });
    }

    const type = getTypeString(parentPath);
    const name = prompt(type+' name (no spaces or slashes):');
    if (name === null) return;
    const invalidName = isInvalidObjName(name);
    if (invalidName !== '') {
        alert(invalidName); return;
    }


    if (parentObj[name]) {
        alert(`"${name}" already exists as a child for ${parentPath}.`)
        return;
    }

    parentObj[name] = template;
    objectTree = buildObjectTree(project);
    renderObjectList();
    return `${parentPath}/${name}`;
}
function getTypeString(path) {
    let ancestor = path.split('/')[1] || '';
    if (ancestor.endsWith('s'))
        ancestor = ancestor.slice(0, -1);
    ancestor = ancestor.charAt(0).toUpperCase() +
        ancestor.substring(1);
    return ancestor;
}
function getTemplateByType(path) {
    const ancestor = path.split('/')[1];
    switch (ancestor) {
        case 'rooms':
            return { '@body': '' };
        case 'commands':
            return { '@effects': '' };
        default:
            return {};
    }
}
function handleRemoveNode(path) {
    const nodeObj = getObjectByPath(project, path);
    if (nodeObj === undefined) return;

    if (hasNonEmptyValue(nodeObj)) {
        const ok = confirm("Are you sure you want to remove '"+path+"'?");
        if (!ok) return;
    }

    // delete
    const segments = path.split('/');
    const key = segments.pop();
    const parentPath = segments.join('/');
    const parentObj = getObjectByPath(project, parentPath);
    if (parentObj && typeof parentObj === 'object') {
        delete parentObj[key];
        objectTree = buildObjectTree(project);
        renderObjectList();
    }

}
function handleRenameNode(path) {
    renameByPath(path);
}
function hasNonEmptyValue(object) {
    return Object.values(object).some((value) => {
        if (value === null || value === undefined) return false;
        if (typeof value === 'string') return value.trim().length > 0;
        return false;
    });
}
function handleChangePanels() {
    isLayoutMenuOpen ? closeLayoutMenu() : openLayoutMenu();
}
function openLayoutMenu() {
    renderLayoutOptions();
    updateOptionVisibility();
    layoutMenu.style.display = 'flex';
    isLayoutMenuOpen = true;
}
function closeLayoutMenu() {
    layoutMenu.style.display = 'none';
    isLayoutMenuOpen = false;
}
function renderLayoutOptions() {
    layoutOptions.innerHTML= '';
    LAYOUTS.forEach(layout => {
        //make button for layout
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.layoutId = layout.id;
        button.textContent = layout.label;
        if (layout.id === currentLayout.layoutId) {
            button.classList.add('is-active');
        }

        // change layout on click
        button.addEventListener('click', () => {
            event.stopPropagation();
            currentLayout.layoutId = layout.id;
            currentLayout.isVertical = false;
            currentLayout.isReverse = false;
            applyCurrentLayout();
            renderLayoutOptions(); // refresh highlight
            updateOptionVisibility();
        });

        layoutOptions.appendChild(button);
    });
}
function updateOptionVisibility() {

    const showVertical =
        currentLayout.layoutId === '1x1' || currentLayout.layoutId === '2x1';
    const showReverse =
        currentLayout.layoutId === '2x1';

    verticalLabel.style.display = showVertical ? 'inline-flex' : 'none';
    reverseLabel .style.display = showReverse  ? 'inline-flex' : 'none';

    verticalCheckbox.checked = currentLayout.isVertical;
    reverseCheckbox .checked = currentLayout.isReverse;
}
function applyCurrentLayout() {
    const grid = document.querySelector('.editor-grid');
    const currentId = currentLayout.layoutId;
    grid.classList.remove('layout-1', 'layout-1x1', 'layout-2x1', 'layout-2x2');
    grid.classList.add(`layout-${currentId}`);
    switch (currentId) {
        case '2x1':
            grid.classList.toggle('is-reverse', currentLayout.isReverse);
        case '1x1':
            grid.classList.toggle('is-vertical', currentLayout.isVertical);
    }

    const layoutInfo = LAYOUTS.find(l => l.id === currentId);
    const slots = layoutInfo ? layoutInfo.slots : 4;
    for (let i = 0; i < 4; i++) {
        const shouldHide = i >= slots;
        const wrapper = viewSlots[i].field.closest('.field');
        if (wrapper) wrapper.style.display = shouldHide ? 'none' : '';
        if (shouldHide) {
            viewSlots[i].path = null;
            viewSlots[i].field.value = '';
            updateLabel(viewSlots[i]);
        }
    }
}
function handleNew() {
    loadProjectState(TEMPLATE);
}
function handleDownload() {
    const json = JSON.stringify(project, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    const isDirty = viewSlots.some(slot => slot.dirty);
    if (isDirty) {
        const ok = confirm('Objects with * are unsaved.\nDownload anyways?');
        if (!ok) return;
    }

    // click a temp link then delete it
    a.href = url;
    a.download = 'narrascript-game.json';   // or let the user name it later
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
function handleLoad() {
    fileInput.click();

    fileInput.addEventListener('change', async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const parsed = JSON.parse(await file.text());
            loadProjectState(parsed);
        } catch (err) {
            // invalid JSON
            alert(`Could not load file:\n${err.message}\n\n(invalid JSON?)`);
        } finally {
            fileInput.value = ''; // allow re-selecting the same file later
        }
    });
}

function saveSlotContent(slotIndex) {
    const slot = viewSlots[slotIndex];
    if (!slot || !slot.path) return true;
    const raw = slot.field.value;
    const trimmed = raw.trim().replace(/,\s*$/, ''); // strips trailing comma
    const sanitized = escapeMultilineStrings(trimmed);

    let parsed;
    console.log('trimmed:', trimmed);
console.log('sanitized:', sanitized);
    try {
        // if field holds only properties, wrap for json parse
        console.log(`Parsing -> {${sanitized}}`);
        parsed = trimmed
            ? JSON.parse(`{${sanitized}}`)
            : {};
    } catch (err) {
        slot.dirty = true;
        updateLabel(slot);
        slot.field.classList.add('has-error');
        showError(slotIndex, err.message);
        return false;
    }

    setObjectByPath(project, slot.path, parsed);
    slot.dirty = false;
    updateLabel(slot);

    slot.field.classList.remove('has-error');
    hideError(slotIndex);
    return true;
}
function handleFieldInput(slotIndex) { 
    saveSlotContent(slotIndex);
}
function handleSlotAction(action, slotIndex) {
    switch (action) {
        case 'clear':
            clearSlot(slotIndex); break;
        case 'rename':
            renameSlot(slotIndex); break;
        case 'add-child':
            addChildFromSlot(slotIndex); break;
    }
}
function clearSlot(slotIndex) {
    const slot = viewSlots[slotIndex];
    if (!slot || !slot.field) return;
    if (slot.path && !saveSlotContent(slotIndex)) {
        const ok = confirm("This object can't be saved because of an error.\nClear anyways?");
        if (!ok) return;
    }

    slot.path = null;
    slot.dirty = false;
    slot.field.value = '';
    slot.field.classList.remove('has-error');
    hideError(slotIndex);
    updateLabel(slot);
}
function renameSlot(slotIndex) {
    const slot = viewSlots[slotIndex];
    if (!slot || !slot.path) {
        alert('Select an object before renaming.');
        return;
    }
    const segments = slot.path.split('/');
    if (segments.length <= 2) {
        alert('Types (player, global, rooms, commands, items, dummy) cannot be renamed.');
        return;
    }
    if (!saveSlotContent(slotIndex)) {
        alert("This object can't be renamed because of current errors.");
        return;
    }
    renameByPath(slot.path);
}
function renameByPath(path) {
    const segments = path.split('/');
    const oldName = segments[segments.length - 1];
    const parentPath = segments.slice(0, -1).join('/');
    const parentObj = getObjectByPath(project, parentPath);
    if (!parentObj || typeof parentObj !== 'object') return;

    const newName = prompt(`Rename "${oldName}" to:`, oldName);
    if (newName === null) return;
    if (newName === oldName) return;

    const invalid = isInvalidObjName(newName);
    if (invalid !== '') {
        alert(invalid);
        return;
    }
    if (parentObj[newName]) {
        alert(`"${newName}" already exists as a child of ${parentPath}.`);
        return;
    }

    parentObj[newName] = parentObj[oldName];
    delete parentObj[oldName];

    const oldPath = path;
    const newPath = parentPath+"/"+newName;

    syncSlotPaths(oldPath, newPath);
    syncCollapsedPaths(oldPath, newPath);

    objectTree = buildObjectTree(project);
    renderObjectList();
}
function addChildFromSlot(slotIndex) {
    const slot = viewSlots[slotIndex];
    if (!slot || !slot.path) {
        alert('Select an object before adding a child.');
        return;
    }
    if (!canAddChild(slot.path)) {
        alert('This object cannot have children.');
        return;
    }
    if (!saveSlotContent(slotIndex)) {
        alert('Cannot create child because of current errors.');
        return;
    }

    const newPath = handleAddChild(slot.path);
    if (newPath) {
        renderViewSlot(slotIndex, newPath);
    }
}
function showError(slotIndex, message) {
    const slot = viewSlots[slotIndex];
    if (!slot || !slot.error) return;
    const wrapper = slot.field.closest('.field');
    slot.error.textContent = message;
    slot.error.classList.add('show');
    wrapper.classList.add('has-error');
}
function hideError(slotIndex) {
    const slot = viewSlots[slotIndex];
    if (!slot || !slot.error) return;
    const wrapper = slot.field.closest('.field');

    slot.error.classList.remove('show');
    wrapper.classList.remove('has-error');
}
function findAvailableSlot() {
    const curLay = currentLayout.layoutId
    const boxes = Number(curLay[0]) + Number(curLay[2]);
    for (let i = 0; i < boxes; i++) {
        if (viewSlots[i].path === null)
            return i;
    }
    return boxes - 1;
}
function syncSlotPaths(oldPath, newPath) {
    viewSlots.forEach((slot, idx) => {
        if (!slot.path) return;
        if (slot.path === oldPath || slot.path.startsWith(oldPath + '/')) {
            const suffix = slot.path.slice(oldPath.length);
            slot.path = newPath + suffix;
            renderViewSlot(idx, slot.path);
        }
    });
}
function syncCollapsedPaths(oldPath, newPath) {
    if (oldPath === newPath) return;
    const updated = new Set();
    collapsed.forEach((path) => {
        if (path === oldPath || path.startsWith(oldPath + '/')) {
            const suffix = path.slice(oldPath.length);
            updated.add(newPath + suffix);
        } else {
            updated.add(path);
        }
    });
    collapsed.clear();
    updated.forEach(path => collapsed.add(path));
}
