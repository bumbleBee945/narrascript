const inputBox = document.getElementById('textInput');
inputBox.focus();
const formInput = document.getElementById('formInput');
formInput.addEventListener('submit', formSubmit);

const resetButton = document.getElementById('resetButton');
resetButton.addEventListener('click', resetCache);

const displayDiv = document.getElementById('display');
let input = '';

const cacheBust = localStorage.getItem('cacheBust') || '';
const gameBase = await
    (await fetch(`game.json?cacheBust=${cacheBust}`)).json();

let gameState = {};
gameState['player'] = structuredClone(gameBase['player']);

let scope = [{}];
let runtimeError = '';

const savedState = localStorage.getItem('savedState');
if (savedState) gameState = JSON.parse(savedState);
const savedScope = localStorage.getItem('savedScope');
if (savedScope) scope = JSON.parse(savedScope);
let inReset = false;

addSaves();
display(currentRoomBody());
//runGlobal();


// PARSING/LOGIC

function formSubmit(event) { // given input
    event.preventDefault();

    input = inputBox.value.toLowerCase();
    inputBox.value = '';
    inputBox.focus();
    parseInput();
}

function parseInput() {
    if (input === 'r') resetCache();
    if (input !== '') {
        display ('> '+input, false);
        // trimmed, per-word array clearing empties
        input = input.split(' ').map(s => s.trim()).filter(Boolean);

        resolveInput();
    } else display('Can you repeat that?');
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
            display(retrieve(['player', '@invalid'])); return;
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

function runEffects(effects) {
    upScope();

    // allow comments
    effects = effects.replace(/\/\/.*$/gm, '');
    let char;
    let callBuilder = '';
    let length = effects.length;
    let depth = 0;

    for (let i = 0; i < length; i++) { // run loop
        char = effects[i];
        if (char.trim() === '' && depth === 0) continue;

        // Run a complete call
        if (char === ';' && depth === 0) {
            runCall(callBuilder);
            callBuilder = '';
        // Check for block start
        } else if (char === '{' && depth === 0) {
            //make if block
            const ifInfo = getBlock(i, effects);
            const ifBlock = effects.substring(ifInfo.start, ifInfo.end);
            i = ifInfo.end; // i jumps to end of if block

            // Check for else
            let elseBlock = null;
            const afterIf = effects.substring(i+1);
            const elseStart = i + 1 + // get the absolute position of possible 'else'
                afterIf.length - afterIf.trimStart().length;
            if (effects.startsWith('else', elseStart) && // has 'else( whitespace or { )'
                effects.substring(elseStart + 4).trim().startsWith('{')) { // else found
                //make else block
                const bracePos = effects.indexOf('{', elseStart);
                if (bracePos === -1) { error(7, [callBuilder]); return; }
                const elseInfo = getBlock(bracePos, effects);
                elseBlock = effects.substring(elseInfo.start, elseInfo.end);
                i = elseInfo.end; // i jumps to end of else block
            }

            //callBuilder is the if(this),
            //ifblock is {this}, else block is else {this}
            runCall(callBuilder, ifBlock, elseBlock);
            callBuilder = '';

        } else callBuilder += char; // keep adding
        if (char === '(') depth++;
        if (char === ')') depth--;

    }

    downScope();

    // error check
    if (depth !== 0)
        error(10, [effects]); // unbalanced parantheses
    else if (callBuilder !== '')
        runCall(callBuilder); // trailing characters
}
function getBlock(cursor, string) {
    cursor++;
    let block = {};
    block.start = cursor;
    let braceCount = 1; // count skipped '{' at start
    while (cursor < string.length && braceCount > 0) {
        if (string[cursor] === '{') braceCount++;
        if (string[cursor] === '}') braceCount--;
        cursor++;
    }
    if (braceCount > 0) { error(11, [string]); return; }

    block.end = cursor - 1;

    return block;
}

function runCall(call, ifBlock = null, elseBlock = null) {
    if (!call.trim()) return;
    if (!validateCall(call, ifBlock, elseBlock)) return;

    if (call.startsWith('if(')) { // Condition call
        // get condition
        let condStart = call.indexOf('(') + 1;
        let condEnd = call.lastIndexOf(')');
        let condition = call.substring(condStart, condEnd);
        // condition is now if(THIS)
        // evaluate and run if (and else), toBool for 't'/'f'/'1'/'0'/1/0
        if (toBoolean(evaluateCondition(condition))) runEffects(ifBlock);
        else if (elseBlock !== null) runEffects(elseBlock);
        // blocks ran
    } else { // Normal call
        const callName = call.split('(')[0].trim();
        let args = call.substring(call.indexOf('(') + 1);
        args = args.slice(0, -1);
        args = parseArgs(args);
        // args -> parsed array w/ vars replaced

        switch (callName) {
            case 'display': display(args); break;
            case 'move': move(args); break;
            case 'add_item': add_item(args); break;
            case 'delete_item': delete_item(args); break;
            //case '' : (args); break;
            //case '' : (args); break;
            default: error(12, [callName]);
        }
    }

}

function runCondition(call, args) {
    switch (call) {
        case 'and':
            args = checkArgs(2, args, 'and', 'boolean');
            return args[0] && args[1];
        case 'or':
            args = checkArgs(2, args, 'or', 'boolean');
            return args[0] || args[1];
        case 'xor':
            args = checkArgs(2, args, 'xor', 'boolean');
            return args[0] !== args[1];
        case 'not':
            args = checkArgs(1, args, 'not', 'boolean');
            return !args[0]
        case 'equals':
            args = checkArgs(2, args, 'equals');
            return args[0] === args[1];
        case 'greater':
            args = checkArgs(2, args, 'greater', 'number');
            return args[0] > args[1];
        case 'isset':
            args = checkArgs(1, args, 'isset');
            return (args[0] !== undefined);
        case 'has_item':
            args = checkArgs(1, args, 'has_item');
            return hasItem(args[0]);
        /*case '':
            args = checkArgs(2, args, '');
            return args[0];*/
        /*case '':
            args = checkArgs(2, args, '');
            return args[0];*/
        default:
            error(12, [call]); return false;
    }
}

function evaluateCondition(condition) {
    condition = condition.trim();
    const parts = condition.match(/^([a-zA-Z_]+)\((.*)\)$/);
    // return condition if no call
    if (!parts) return condition;
    const call = parts[1];
    const args = parseArgs(parts[2]);
    //call is now this(_), args are now _(this)
    //evaluate each arg recursively
    let evaluatedArgs = [];
    for (let i = 0; i < args.length; i++) {
        evaluatedArgs[i] = evaluateCondition(args[i]);
    }

    return runCondition(call, evaluatedArgs);
}

function parseArgs(args) {
    return splitTopArgs(args).map(arg => parseValue(arg));
}
function splitTopArgs(string) {
    let depth = 0;
    let args = [];
    let currentArg = '';

    for (let i = 0; i < string.length; i++) {
        const char = string[i];
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

// VARIABLE LOGIC

function retrieve(path = []) {

    //look in base
    let foundBase = true;
    let cursor = gameBase;
    for (let i = 0; i < path.length; i++)
        if (!(path[i] in cursor)) {
            foundBase = false; break;
        } else cursor = cursor[path[i]];
    let valueBase = cursor;

    //look in state
    let foundState = true;
    cursor = gameState;
    for (let i = 0; i < path.length; i++)
        if (!(path[i] in cursor)) {
            foundState = false; break;
        } else cursor = cursor[path[i]];
    let valueState = cursor;

    // couldnt find error
    if (!foundBase && !foundState) {
        error(9, [JSON.stringify(path)]); return undefined; }

    //return state if exists, or base
    return (foundState ? valueState : valueBase);
}

function parseValue(string) {
    let result = '';
    let currentVar = '';
    let inVar = false;
    let char;

    for (let i = 0; i < string.length; i++) {
        char = string[i];

        if (char === '$' || char === '#') { // if start of variable
            if (string.length > i+1 && char === string[i+1]) { // if doubled
                result += char; i++;
            } else { // if not doubled, in variable
                inVar = true; currentVar = char;
            }
            continue; // ignore if(inVar)
        }

        if (inVar) { // add to var, if exists add value to result
            currentVar += char; // add to current var
            if (getVar(currentVar) === undefined) continue; 
            result += getVar(currentVar); // var exists
            currentVar = '';
            inVar = false;
        }

        else result += char; // no var; keep adding
    }

    if (inVar) error(5, [currentVar]); // error check if never found var
    return result; // return parsed string
}

// ERROR HANDLING

function validateCall(call, ifBlock, elseBlock) {
    
    //check that if or else isnt missing block
    if (call.startsWith('if(') && ifBlock === null) {
        error(7, [call]); return false;
    }
    //check for ( after call
    if (!call.includes('(')) {
        error(8, [call]); return false;
    }

    //valid call
    return true;
}

function toBoolean(given, callName) {
    if (typeof given === 'boolean') return given;
    if (typeof given === 'number') return given !== 0;
    if (typeof given === 'string') {
        //'true'=true, 'false'=false, '(number)'!==0
        if (given === 'true') return true;
        if (given === 'false') return false;
        if (!Number.isNaN(Number(given))) return n !== 0;
        error(13, [given, callName]); return false;
    }
    error(14, [callName, typeof given]); return false;
}

function toNumber(given, callName) {
    let original = given;
    given = Number(original);
    if (Number.isNaN(given))
        //'false' = 0, 'true' = 1
        if (original === 'false' || original === 'true') return Number(toBoolean(original));
        else error(1, [callName, original]);
    return given;
}

function checkArgs(expectedArgs, givenArgs, callName, type = 'string') {
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
        if (type === 'string') givenArgs[i] = String(givenArgs[i]);
        if (type === 'number') givenArgs[i] = toNumber(givenArgs[i], callName);
        if (type === 'boolean') givenArgs[i] = toBoolean(givenArgs[i], callName);
    } // convert to type

    return givenArgs;
}

function error(code, info) {
    let errorMsg = 'internal error eMe'
    switch (code) {
        case 0: // Wrong call argument amount (call, expected, given)
            errorMsg = "Call '"+info[0]+"' expects "+info[1]+" arguments, received "+info[2]+"."; break;
        case 1: // Couldnt convert to number (call, string)
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
        case 12: // unknown call (name)
            errorMsg = "Unknown call '"+info[0]+"'."; break;
        case 13: // cant convert string to boolean (string, call)
            errorMsg = "Couldn't convert '"+info[0]+"' to 'true' or 'false' for '"+info[1]+"'."; break;
        case 14: // cannot find item in inventory
            errorMsg = "Couldn't find item '"+info[0]+"' in player/@inventory"; break;
        /*case 15: // 
            errorMsg = ""; break;*/
        /*case 16: // 
            errorMsg = ""; break;*/
    }
    runtimeError = '[!] Error: '+errorMsg;
}

// CALLS

function hasItem(item) {
    let items = retrieve(['player', '@inventory']).split(',');
    for (let i = 0; i < items.length; i++)
        if (items[i].trim() === item.trim()) return true;
    return false;
}


function display(args, isSpaced = true) {
    args = checkArgs(1, args, 'display')
    const textNode = document.createTextNode(args[0]);
    displayDiv.appendChild(textNode);
    displayDiv.appendChild(document.createElement('br'));
    if (isSpaced)
        if (runtimeError === '')
            displayDiv.appendChild(document.createElement('br'));
        else {
            const error = runtimeError;
            runtimeError = '';
            display(error);
        }
    displayDiv.scrollTop = displayDiv.scrollHeight;
}

function move(args) {
    checkArgs(1, args, 'move');
    gameState['player']['@room'] = args[0];
    display(currentRoomBody());
}

function add_item(args) {
    checkArgs(1, args, 'add_item');
    const item = args[0];
    const inv = retrieve(['player', '@inventory']);
    if (inv === '') gameState['player']['@inventory'] = item;
    else gameState['player']['@inventory'] = inv+', '+item;
}

function delete_item(args) {
    checkArgs(1, args, 'delete_item');
    const item = args[0];
    const inv = retrieve(['player', '@inventory']);
    if (!inv.includes(item)) { error(14, [item]); return; }
    if (inv.startsWith(item))
        gameState['player']['@inventory'] = inv.substring(item.length + 2);
    else
        gameState['player']['@inventory'] = inv.replace(', '+item, '');
}

// HELPER FUNCTIONS

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function upScope() {
    scope.push({});
}
function downScope() {
    scope.pop();
}
function setVar(varName, value) {
    scope[scope.length - 1][varName] = value;
}
function getVar(name) {
    // search from top to bottom
    for (let i = scope.length - 1; i >= 0; i--) {
    if (name in scope[i]) return scope[i][name];
    }
    return undefined;
}
function currentRoomBody() {
    const room = retrieve(['player', '@room']);
    const body = retrieve(['rooms', room, '@body']);
    return body;
}


async function resetCache() {
    inReset = true;
    localStorage.removeItem('savedState');
    localStorage.removeItem('savedScope');
    localStorage.setItem('cacheBust', Date.now());
    location.reload();
}

function addSaves() {
    window.addEventListener('beforeunload', () => {
        if (inReset) return;
        localStorage.setItem('savedState', JSON.stringify(gameState));
        localStorage.setItem('savedScope', JSON.stringify(scope));
    });
}