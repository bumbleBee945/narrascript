/*

Narrascript Logic File (./public/logic.js)
Last updated 10/24/25 by Avery Olsen

Logic JavaScript file; parsing, variable substitution, everything but calls
Imports from state.js, calls.js

*/

// Imports

import { gameState, setError, displayDiv, runtimeError, setPlain, plainDisplay } from "./state.js";
import { checkArgs, error, retrieve, setVar, findObj, getVar, toNumber } from "./logic.js";

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
        case 'isset': args = checkArgs(1, args, 'isset'); return (getVar(args[0]) !== undefined);
        default: display('internal error (no simple) ['+call+']'); return false;
    }
}
export function math(call, args) { // all math
    switch (call) {
    case 'add': args = checkArgs(2, args, 'add', 'num');
        return args[0] + args[1];
    case 'sub': args = checkArgs(2, args, 'sub', 'num');
        return args[0] - args[1];
    case 'mult': args = checkArgs(2, args, 'mult', 'num');
        return args[0] * args[1];
    case 'div': args = checkArgs(2, args, 'div', 'num');
        return args[0] / args[1];
    case 'mod': args = checkArgs(2, args, 'mod', 'num');
        return args[0] % args[1];
    case 'pow': args = checkArgs(2, args, 'pow', 'num');
        return Math.pow(args[0], args[1]);
    case 'sqrt': args = checkArgs(1, args, 'sqrt', 'num');
        return Math.sqrt(args[0]);
    case 'round': args = checkArgs(1, args, 'round', 'num');
        return Math.round(args[0]);
    case 'random':
        args = (args === '' ? [''] : checkArgs(2, args, 'random', 'num'));
        if (args[0] === '') return Math.random();
        return parseInt(Math.random() * (args[1] - args[0] + 1)) + args[0];
    case 'abs': args = checkArgs(1, args, 'abs', 'num');
        return Math.abs(args[0]);
    case 'floor': args = checkArgs(1, args, 'floor', 'num');
        return Math.floor(args[0]);
    case 'ceil': args = checkArgs(1, args, 'ceil', 'num');
        return Math.ceil(args[0]);
    case 'min': args = checkArgs(2, args, 'min', 'num');
        return Math.min(args[0], args[1]);
    case 'max': args = checkArgs(2, args, 'max', 'num');
        return Math.max(args[0], args[1]);
    case 'cos': args = checkArgs(1, args, 'cos', 'num');
        return Math.cos(args[0]);
    case 'sin': args = checkArgs(1, args, 'sin', 'num');
        return Math.sin(args[0]);
    case 'tan': args = checkArgs(1, args, 'tan', 'num');
        return Math.tan(args[0]);
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
export function add(args) {
    args = checkArgs(2, args, 'add', 'num');
    return args[0] + args[1];
}
export function getProperty(args) {
    args = checkArgs(2, args, 'getProperty');
    let obj = args[0].split("/");
    if (!retrieve(obj, true)) { error(16, [args[0]]); return; }

    obj.push(args[1]);
    if (!retrieve(obj, true)) { obj.pop(); error(17, [args[1], obj]); return; }

    return retrieve(obj);
}
export function toNum(args) {
    args = checkArgs(1, args, 'toNum');
    const result = args[0]
        .replace(/[^\d.]/g, '')      // strip anything that isn't a digit or a dot
        .replace(/\.(?=.*\.)/g, ''); // remove every dot that has another dot to its right
    return result;
}
export function stringManip(call, args) {
    switch (call) {
        case 'trim':
            args = checkArgs(1, args, 'trim');
            return args[0].trim();
        case 'length':
            return size(args);
        case 'size':
            args = checkArgs(1, args, 'size');
            return args[0].length;
        case 'replace':
            args = checkArgs(3, args, 'replace');
            return args[0].replace(args[1], args[2]);
        case 'replaceAll':
            args = checkArgs(3, args, 'replaceAll');
            return args[0].replaceAll(args[1],args[2]);
        case 'indexOf':
            args = checkArgs(2, args, 'indexOf');
            return args[0].indexOf(args[1]);
        case 'toUpper':
            args = checkArgs(1, args, 'toUpper');
            return args[0].toUpper();
        case 'toLower':
            args = checkArgs(1, args, 'toLower');
            return args[0].toLower();
        case 'repeat':
            args = checkArgs(2, args, 'repeat');
            args[1] = checkArgs(1, args[1], 'repeat', 'num')[0];

            return args[0].repeat(args[1]);
        case 'charAt':
            args = checkArgs(2, args, 'charAt');
            args[1] = checkArgs(1, args[1], 'charAt', 'num')[0];

            return args[0].charAt(args[1]);
    }
}


// Action Calls (display, move, set)

export function display(args, isSpaced = true) {
    let text;
    if (args === -1) { // reset display value
        displayDiv.replaceChildren();
        text = plainDisplay;
    } else { // append to displaydiv and plaindisplay

        args = checkArgs(1, args, 'display');
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
    gameState['main']['player']['@room'] = args[0];
    display(currentRoomBody());
}
export function addItem(args) {
    checkArgs(1, args, 'addItem');
    const item = args[0];
    const inv = retrieve(['player', '@inventory']);
    if (inv === '') gameState['main']['player']['@inventory'] = item;
    else gameState['main']['player']['@inventory'] = inv+', '+item;
}
export function deleteItem(args) {
    checkArgs(1, args, 'deleteItem');
    const item = args[0];
    const inv = retrieve(['player', '@inventory']);
    if (!inv.includes(item)) { error(14, [item]); return; }
    if (inv.startsWith(item))
        gameState['main']['player']['@inventory'] = inv.substring(item.length + 2);
    else
        gameState['main']['player']['@inventory'] = inv.replace(', '+item, '');
}
export function setProperty(args) {
    args = checkArgs(3, args, 'setProperty');
    let obj = findObj(args[0]);
    if (obj === undefined) return;

    obj[args[1]] = args[2];
}
export function set(args) {
    args = checkArgs(2, args, 'set');

    setVar(args[0], args[1]);
}
export function inc(args) {
    args = checkArgs(1, args, 'inc');
    setVar(args[0],
        toNumber(getVar(args[0]), 'inc') + 1);
}
export function dec(args) {
    args = checkArgs(1, args, 'dec');
    setVar(args[0],
        toNumber(getVar(args[0]), 'dec') - 1);
}
export function make(args) {
    args = checkArgs(2, args, 'make');

    switch (args[0]) { // validate type
        case 'command':
        case 'player':
        case 'global':
            error(19, []); return;
        case 'room':
            args[0] = 'rooms';
            break;
        case 'item':
            args[0] = 'items';
            break;
        case 'dummy':
            break;
        default: error(20, [args[0]]); return;
    }

    const pathParts = [args[0], ...args[1].split('/')];
    // check it exists
    const obj = retrieve(pathParts, true);
    if (obj !== false) { error(18, [args[0]+'/'+args[1]]); return; }

    let current = gameState['main'];
    for (let next = 0; next < pathParts.length; next++) {
        current[pathParts[next]] = current[pathParts[next]] ?? {};
        current = current[pathParts[next]];
    }
}