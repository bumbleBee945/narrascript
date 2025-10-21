/*

Narrascript Main File (./public/main.js)
Last updated 10/21/25 by Avery Olsen

Main JavaScript file; session load/save, initialization, overall control flow.
Imports from logic.js, calls.js, state.js

*/



// Imports

import { setBase, setState, setReset, setInput, setScope, setDisplay, gameBase, setPlain } from "./state.js";
import { runGlobal, parseInput, resetCache, addSaves } from "./logic.js";
import { display, currentRoomBody } from "./calls.js";

// HTML Element Bindings, Listeners

const textInput = document.getElementById('textInput');
const formInput = document.getElementById('formInput');
setDisplay(document.getElementById('display'));
const resetButton = document.getElementById('resetButton');

resetButton.addEventListener("click", resetCache);
formInput.addEventListener("submit", getInput);

// Initialization

const cacheBust = localStorage.getItem('cacheBust') || '';
setBase(await (await fetch(`game.json?cacheBust=${cacheBust}`)).json());
setState(structuredClone(gameBase['main']['player']));
setReset(false);

// Session Saving, Restoring

const savedDisplay = localStorage.getItem('savedDisplay');
if (savedDisplay) setPlain(savedDisplay); display(-1);
const savedState = localStorage.getItem('savedState');
if (savedState) setState(JSON.parse(savedState));
const savedScope = localStorage.getItem('savedScope');
if (savedScope) setScope(JSON.parse(savedScope));
addSaves();

// Game Code

textInput.focus();
if (!savedDisplay) display(currentRoomBody());
runGlobal();

function getInput(event) {
    event.preventDefault();
    setInput(textInput.value.trim().toLowerCase());
    textInput.value = '';
    textInput.focus();
    parseInput();
}
