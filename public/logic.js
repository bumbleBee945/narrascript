/*

Narrascript Logic File (./public/logic.js)
Last updated 10/24/25 by Avery Olsen

Logic JavaScript file; parsing, variable substitution, everything but calls
Imports from state.js, calls.js

*/


// Imports

import { gameBase, setInput, gameState, scope, input, setError, inReset, setReset, plainDisplay } from "./state.js";
import * as Calls from "./calls.js";

// Understand Input

export function parseInput() {
    if (input === 'r') resetCache();
    if (input !== '') {
        Calls.display('> '+input, false);
        // trimmed, per-word array clearing empties
        setInput(input.split(' ').map(s => s.trim()).filter(Boolean));

        resolveInput();
    } else Calls.display('Can you repeat that?');
}
function resolveInput() {

    // cursor to ['commands']
    let cursor = retrieve(['commands']);

    for (let i = 0; i < input.length; i++) {
        if (input[i] in cursor) { // valid; go deeper
            cursor = cursor[input[i]];
        } else if ('default' in cursor) { // invalid; try to take default
            cursor = cursor['default']; break;
        } else { // no default; invalid command
            Calls.display(retrieve(['player', '@invalid'])); return;
        }
    }
    // take default if possible
    if ('default' in cursor) cursor = cursor['default'];

    // check for errors
    if (!('@effects' in cursor)) {
        error(3, [JSON.stringify(cursor)]); return; }

    // no errors
    runEffects(cursor['@effects']);
}

// Run Functions

export function runGlobal() {
    downScope();
    runEffects(gameBase['main']['global']['@effects']);
    upScope();
}
function runEffects(fullStr) {
    upScope();
    let char = '';
    let currentCall = '';

    // allow comments
    // fullStr = fullStr.replace(/\/\/.*$/gm, '');

    let depth = 0;
    let length = fullStr.length;
    for (let cursor = 0; cursor < length; cursor++) { // run loop
        char = fullStr[cursor];
        // ignore whitespace
        if (char.trim() === '' && depth === 0) continue;

        // Escape char
        if (char === '\\' && length > cursor+1) {
            cursor++;
            //dont pass whitespace
            if (fullStr[cursor].trim() === '' && depth === 0) continue

            currentCall += char;
            currentCall += fullStr[cursor];
            continue;

        // complete call
        }
        if (char === ';' && depth === 0) {
            runActionCall(currentCall);
            currentCall = '';
            continue;
        // check for block (while, if, for)
        }
        if (char === '{' && depth === 0) {
            cursor = runBlock(fullStr, cursor, currentCall);
            currentCall = '';
            continue;
        }

        currentCall += char; // keep adding
        if (char === '(') depth++;
        if (char === ')') depth--;

    }

    downScope();

    // error check
    if (depth !== 0)
        error(10, [fullStr]); // unbalanced parantheses
    else if (currentCall !== '')
        runActionCall(currentCall); // trailing characters
}

function runBlock(fullStr, cursor, currentCall) {
        //make block
        const blockInfo = getBlock(cursor, fullStr);
        const blockContent = fullStr.substring(blockInfo.start, blockInfo.end);
        let secondaryContent = null;
        cursor = blockInfo.end; // jump cursor to end

        // No secondary content, good to continue
        if (!currentCall.startsWith('if(')) {
            runBlockCall(currentCall, blockContent);
            return blockInfo.end;
        }

        // get content after if()
        const afterIf = fullStr.substring(blockInfo.end + 1);
        // get the abs position of possible else
        const elseStart = blockInfo.end + 1 + afterIf.length - afterIf.trimStart().length;

        if (!(fullStr.startsWith('else', elseStart) && // if no else
                    fullStr.substring(elseStart + 4).trim().startsWith('{'))) {
            runBlockCall(currentCall, blockContent); return blockInfo.end; }

        //make else block
        const bracePos = fullStr.indexOf('{', elseStart);
        const secondaryInfo = getBlock(bracePos, fullStr);
        secondaryContent = fullStr.substring(secondaryInfo.start, secondaryInfo.end);

        runBlockCall(currentCall, blockContent, secondaryContent);
        return secondaryInfo.end;
}
function runActionCall(call) {
    console.log('runnin '+call);
    if (!call.trim()) return;
    if (!validateCall(call)) return;

    const callName = call.split('(')[0].trim();
    let args = call.substring(call.indexOf('(') + 1);
    args = args.slice(0, -1);
    // if set(), dont parse first value
    args = parseArgs(args, (callName === 'set' ? false : true));
    // args -> parsed array w/ vars replaced

    switch (callName) {
        case 'display': Calls.display(args); break;
        case 'move': Calls.move(args); break;
        case 'addItem': Calls.addItem(args); break;
        case 'deleteItem': Calls.deleteItem(args); break;
        case 'setProperty' : Calls.setProperty(args); break;
        case 'set': 
            Calls.set(args);
            break;
        case 'add' : Calls.add(args); break;
        //case '' : (args); break;
        default: error(12, [callName]);
    }
}
function runBlockCall(call, blockContent, secondaryContent = null) {
    console.log('runnin ' +call);
    if (!call.trim()) return;
    if (!validateCall(call, blockContent)) return;
    const callName = call.split('(')[0].trim();

    switch (callName) {
        case 'if':
            // get condition
            let condStart = call.indexOf('(') + 1;
            let condEnd = call.lastIndexOf(')');
            let condition = call.substring(condStart, condEnd);
            let result = parseArgs(condition)[0];
            // result is now true/false
            if (toBoolean(result)) runEffects(blockContent);
            else if (secondaryContent !== null) runEffects(secondaryContent);
            break;
    }
}
function runReturnCall(callName, args) {
    console.log('runnin '+callName+' with args ('+args+')');
    switch (callName) {
        case 'and': case 'or': case 'xor': case 'not':
        case 'equals': case 'greater': case 'isset':
            return Calls.simple(callName, args); // basic ones
        case 'add': case 'sub': case 'mult': case 'div':
        case 'mod': case 'pow': case 'sqrt': case 'abs':
        case 'round': case 'random': case 'floor':
        case 'ceil': case 'min': case 'max':
        case 'cos': case 'sin': case 'tan':
            return Calls.math(callName, args); // math
        case 'hasItem': return Calls.hasItem(args);

        default: error(12, [callName]); return false;
    }
}

// Parsing, Evaluation Functions

function getBlock(cursor, string) {
    cursor++;
    let block = {};
    block.start = cursor;
    let braceCount = 1; // count skipped '{' at start
    while (cursor < string.length && braceCount > 0) {
        if (string[cursor] === '\\' && string.length > cursor + 1) { // escape char
            cursor += 2; continue; }
        if (string[cursor] === '{') braceCount++;
        if (string[cursor] === '}') braceCount--;
        cursor++;
    }
    if (braceCount > 0) { error(11, [string]); return; }

    block.end = cursor - 1;

    return block;
}
function evaluate(givenValue) {
    givenValue = (givenValue+'').trim();
    const parts = givenValue.match(/^([a-zA-Z_]+)\((.*)\)$/);

    // return if no return call
    if (!parts) { return givenValue; }

    const returnCall = parts[1];
    const args = parseArgs(parts[2]); // args is an array
    //returnCall is now THIS(), args are now (THIS)
    //evaluate each arg recursively
    let evaluatedArgs = [];
    for (let i = 0; i < args.length; i++) {
        evaluatedArgs[i] = evaluate(args[i]);
    }

    return runReturnCall(returnCall, evaluatedArgs);
}
function parseArgs(args, parseFirst = true) {
    console.log('parseArgs on '+args);
    //args is 'sqrt(4), #two, Two'
    args = splitArgs(args);
    //args is ['sqrt(4)', '#two', 'Two']
    for (let i = 0; i < args.length; i++) {
        if (!parseFirst && i === 0) continue;
        args[i] = parseValue(args[i]);
        args[i] = evaluate(args[i]);
    }
    //args is [2, 2, 'Two']
    return args;
}
function splitArgs(string) {
    let depth = 0;
    let args = [];
    let currentArg = '';

    for (let i = 0; i < string.length; i++) {
        const char = string[i];
        // escape char
        if (char === '\\' && string.length > i+1) {
            currentArg += string[i+1];
            i++; continue;
        }
        if (char === '(') depth++;
        if (char === ')') depth--;
        if (char === ',' && depth === 0) {
            args.push(currentArg.trim());
            currentArg = '';
        } else currentArg += char;
    }
    args.push(currentArg.trim());

    return args;
}

// Variable Functions

export function retrieve(path = [], suppress = false) {

    //look in base
    let foundBase = true;
    let cursor = gameBase['main'];
    for (let i = 0; i < path.length; i++) {
        if (!(path[i] in cursor)) {
            foundBase = false; break;
        } else cursor = cursor[path[i]]; }
    let valueBase = cursor;

    //look in state
    let foundState = true;
    cursor = gameState['main'];
    for (let i = 0; i < path.length; i++) {
        if (!(path[i] in cursor)) {
            foundState = false; break;
        } else { cursor = cursor[path[i]]; }
    }
    let valueState = cursor;

    // couldnt find error
    if (!foundBase && !foundState) {
        if (suppress) return false;
        error(9, [JSON.stringify(path)]); return undefined; }

    //return state if exists, or base
    return (foundState ? valueState : valueBase);
}
function parseValue(string) {
    console.log('parsing '+string);

    let result = '';
    let currentVar = '';
    let inVar = false;
    let char;

    for (let i = 0; i < string.length; i++) {
        char = string[i];

        if (char === '\\' && string.length > i+1) { // escape char
            i++; // get escaped char
            result += string[i]; // add to result
            continue;
        } else if (char === '$' || char === '#') { // variable start
            inVar = true; currentVar = char;
            continue; //
        }

        if (inVar) { // add to var, if exists add value to result
            currentVar += char; // add to current var
            if (getVar(currentVar) === undefined)
                continue; 
            result += getVar(currentVar); // var exists
            currentVar = '';
            inVar = false;
        }

        else result += char; // no var; keep adding
    }

    if (inVar) error(5, [currentVar]); // error check if never found var
    return result; // return parsed string
}
export function setVar(varName, value) {
    if (!varName.startsWith('$') && !varName.startsWith('#')) {
        error(15, [varName]); return; }
    scope[scope.length - 1][varName] = value;
}
export function getVar(name) {
    // search from top to bottom
    for (let i = scope.length - 1; i >= 0; i--) {
    if (name in scope[i]) return scope[i][name];
    }
    return undefined;
}
export function findObj(obj) {
    const result = retrieve(obj.split("/"), true);
    if (result === false) { error(16, [obj]); return; }
    return result;
}

// Scope Manipulation

function upScope() {
    scope.push({});
}
function downScope() {
    scope.pop();
}

// Type Conversion

export function toBoolean(given, callName) {
    if (typeof given === 'boolean') return given;
    if (typeof given === 'number') return given !== 0;
    if (typeof given === 'string') {
        //'true'=true, 'false'=false, '(number)'!==0
        if (given === 'true') return true;
        if (given === 'false') return false;
        if (!Number.isNaN(Number(given))) return Number(given) !== 0;
        error(13, [given, callName]); return false;
    }
    error(14, [callName, typeof given]); return false;
}
export function toNumber(given, callName) {
    let original = given;
    given = Number(original);
    if (Number.isNaN(given))
        //'false' = 0, 'true' = 1
        if (original === 'false' || original === 'true') return Number(toBoolean(original));
        else error(1, [callName, original]);
    return given;
}

// Session Management (Saves)

export async function resetCache() {
    setReset();
    localStorage.removeItem('savedState');
    localStorage.removeItem('savedScope');
    localStorage.removeItem('savedDisplay');
    localStorage.setItem('cacheBust', Date.now());
    location.reload();
}
export function addSaves() {
    window.addEventListener('beforeunload', () => {
        if (inReset) return;
        localStorage.setItem('savedState', JSON.stringify(gameState));
        localStorage.setItem('savedScope', JSON.stringify(scope));
        localStorage.setItem('savedDisplay', plainDisplay);
    });
}

// Error Handling

function validateCall(call, blockContent = null) {
    
    //check that if isnt missing block
    if (call.startsWith('if(') && blockContent === null) {
        error(7, [call]); return false;
    }
    //check for ( after call
    if (!call.includes('(')) {
        error(8, [call]); return false;
    }

    //valid call
    return true;
}
export function checkArgs(expectedArgs, givenArgs, callName, type = 'string') {
    if (expectedArgs === 0 && givenArgs === '') return [''];
    // string or number to array conversion
    if (typeof givenArgs === 'string' || typeof givenArgs === 'number' ||
        typeof givenArgs === 'boolean')
        givenArgs = [givenArgs];

    // error handling and checks
    if (!Array.isArray(givenArgs)) error(6, [callName, givenArgs]); // only arrays
    if ((expectedArgs !== -1) && (givenArgs.length !== expectedArgs)) 
        error(0, [callName, expectedArgs, givenArgs]); // expected != given
    givenArgs.forEach((given) => // given undefined
        { if (given === undefined) error(2, [callName]); });

    for (let i = 0; i < givenArgs.length; i++) {
        if (type === 'string' || type === 'str') givenArgs[i] = String(givenArgs[i]);
        if (type === 'number' || type === 'num') givenArgs[i] = toNumber(givenArgs[i], callName);
        if (type === 'boolean' || type === 'bool') givenArgs[i] = toBoolean(givenArgs[i], callName);
    } // convert to type

    return givenArgs;
}
export function error(code, info) {
    let errorMsg = 'internal error (eMe) ['+code+'], ['+JSON.stringify(info)+']'
    switch (code) {
        case 0: // wrong call argument amount (call, expected, given)
            errorMsg = "Call '"+info[0]+"' expects "+info[1]+" arguments, received "+info[2]+"."; break;
        case 1: // cant convert to number (call, string)
            errorMsg = "Call '"+info[0]+"' expected number, received '"+info[1]+"'."; break;
        case 2: // undefined call arg (call)
            errorMsg = "Call '"+info[0]+"' was passed an undefined value."; break;
        case 3: // undefined command effects (command)
            errorMsg = "Command '"+info[0]+"' has no @effects property."; break;
        case 4: // trailing effects (call)
            errorMsg = "Unknown trailing call '"+info[0]+"'."; break;
        case 5: // var doesnt exist (varName)
            errorMsg = "Cannot find variable '"+info[0]+"'."; break;
        case 6: // checkArgs non-array (call, type)
            errorMsg = "Call '"+info[0]+"' expected string(s) or number(s), got '"+info[1]+"'."; break;
        case 7: // no { when expected (call)
            errorMsg = "Call '"+info[0]+"' contains no block, '{' expected."; break;
        case 8: // no ( when expected (call)
            errorMsg = "Call '"+info[0]+"' missing '('."; break;
        case 9: // non-existent path (path)
            errorMsg = "Path '"+JSON.stringify(info)+"' does not exist."; break;
        case 10: // unbalanced parantheses (effects)
            errorMsg = "Unbalanced parantheses in effects '"+info[0]+"'."; break;
        case 11: // unbalanced braces (block)
            errorMsg = "Unbalanced braces in block '"+info[0]+"'."; break;
        case 12: // unknown action call (name)
            errorMsg = "Unknown action call '"+info[0]+"'."; break;
        case 13: // cant convert string to boolean (string, call)
            errorMsg = "Couldn't convert '"+info[0]+"' to 'true' or 'false' for '"+info[1]+"'."; break;
        case 14: // cant find item in inventory
            errorMsg = "Couldn't find item '"+info[0]+"' in player/@inventory"; break;
        case 15: // unprefixed variable
            errorMsg = "Variables should be prefixed with $ (value), $_ (list), or # (number). Received variables '"+info[0]+"'."; break;
        case 16: // cant find object
            errorMsg = "Cannot find object '"+info[0]+"'."; break;
        case 17: // cant find property
            errorMsg = "Cannot find property '"+info[0]+"' in object '"+info[1]+"'."; break;
        /*case 18: // 
            errorMsg = ""; break;*/
        /*case 18: // 
            errorMsg = ""; break;*/
        /*case 18: // 
            errorMsg = ""; break;*/
        /*case 18: // 
            errorMsg = ""; break;*/
        /*case 18: // 
            errorMsg = ""; break;*/
    }
    setError('[!] Error: '+errorMsg);
}



