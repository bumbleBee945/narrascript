/*

Narrascript Logic File (./public/logic.js)
Last updated 10/21/25 by Avery Olsen

Logic JavaScript file; parsing, variable substitution, everything but calls
Imports from state.js, calls.js

*/

// Imports

import { gameState, setError, displayDiv, runtimeError, setPlain, plainDisplay } from "./state.js";
import { checkArgs, error, retrieve } from "./logic.js";

// Code Scoped Functions

export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
export function currentRoomBody() {
    const room = retrieve(['player', '@room']);
    const body = retrieve(['rooms', room, '@body']);
    return body;
}

// Return Calls (hasItem, length, add)

export function simple(call, args) { // (and,or,xor,not,equals,greater,isset)
    switch (call) {
        case 'and': args = checkArgs(2, args, 'and', 'bool'); return args[0] && args[1];
        case 'or': args = checkArgs(2, args, 'or', 'bool'); return args[0] || args[1];
        case 'xor': args = checkArgs(2, args, 'xor', 'bool'); return args[0] !== args[1];
        case 'not': args = checkArgs(1, args, 'not', 'bool'); return !args[0];
        case 'equals': args = checkArgs(2, args, 'equals'); return args[0] === args[1];
        case 'greater': args = checkArgs(2, args, 'greater', 'num'); return args[0] > args[1];
        case 'isset': args = checkArgs(1, args, 'isset'); return (args[0] !== undefined);
        default: display('internal error (no simple) ['+call+']'); return false;
    }
}
export function hasItem(args) {
    args = checkArgs(1, args, 'hasItem');
    console.log(args[0]);
    let items = retrieve(['player', '@inventory']).split(',');
    for (let i = 0; i < items.length; i++)
        if (items[i].trim() === args[0].trim()) return true;
    return false;
}

// Action Calls (display, move, set)

export function display(args, isSpaced = true) {
    let text;
    if (args === -1) { // reset display value
        displayDiv.replaceChildren();
        text = plainDisplay;
    } else { // append to displaydiv and plaindisplay

        args = checkArgs(1, args, 'display')
        text = args[0] + '%n';

        if (runtimeError !== '') { // pending error message
            text += runtimeError + '%n';
            setError('');
        } else if (isSpaced) // two-line space (default)
            text += '%n';

        setPlain(plainDisplay + text);

    }
    // render %n's as line breaks
    let parsed = '';
    let parts = text.split('%n');
    for (let i = 0; i < parts.length-1; i++)
        parsed += parts[i]+'\n';

    displayDiv.appendChild(document.createTextNode(parsed));
    displayDiv.scrollTop = displayDiv.scrollHeight;
}
export function move(args) {
    checkArgs(1, args, 'move');
    gameState['player']['@room'] = args[0];
    display(currentRoomBody());
}
export function addItem(args) {
    checkArgs(1, args, 'addItem');
    const item = args[0];
    const inv = retrieve(['player', '@inventory']);
    if (inv === '') gameState['player']['@inventory'] = item;
    else gameState['player']['@inventory'] = inv+', '+item;
}
export function deleteItem(args) {
    checkArgs(1, args, 'deleteItem');
    const item = args[0];
    const inv = retrieve(['player', '@inventory']);
    if (!inv.includes(item)) { error(14, [item]); return; }
    if (inv.startsWith(item))
        gameState['player']['@inventory'] = inv.substring(item.length + 2);
    else
        gameState['player']['@inventory'] = inv.replace(', '+item, '');
}
export function setProperty(args) {
    checkArgs(3, args, 'setProperty');
    let obj = retrieve(args.split("/"), true);
    if (!obj) { error(16, [args[0]]); return; }
    
    obj.push(args[1]);
    if (!obj) { error(17, [args[1], obj.pop()]); return; }
    
    retrieve(obj) = args[2];
}



