/*

Narrascript Main File (./public/main.js)
Last updated 11/12/25 by Avery Olsen

Main JavaScript file; session load/save, initialization, overall control flow.
Imports from logic.js, calls.js, state.js

*/



// Imports

import { setBase, setState, setReset, setInput, setScope, setDisplay, gameBase, setPlain } from "./state.js";
import { runGlobal, parseInput, resetCache, addSaves } from "./logic.js";
import { display, currentRoomBody } from "./calls.js";

// HTML Element Bindings, Listeners
setDisplay(document.getElementById('display'));

const loaderPanel = document.getElementById('gameLoader');
const shell = document.getElementById('gameShell');
const filePicker = document.getElementById('gameFilePicker');
const btnFileStart = document.getElementById('gameFileUse');
const storedGame = localStorage.getItem('uploadedGame');

const textInput = document.getElementById('textInput');
const formInput = document.getElementById('formInput');
const resetButton = document.getElementById('resetButton');

resetButton.addEventListener("click", resetCache);
formInput.addEventListener("submit", getInput);

btnFileStart.addEventListener('click', async () => {
    const file = filePicker.files?.[0];
    if (!file) { alert('Upload a game file first.'); return; }

    try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        localStorage.setItem('uploadedGame', text);
        bootstrapGame(parsed);
    } catch (err) {
        alert('Invalid game file JSON: ' + err.message);
    }
});


// Initialization

if (storedGame) {
    btnFileStart.style.display = 'flex';
    bootstrapGame(JSON.parse(storedGame));
} else {
    loaderPanel.style.display = 'flex';
}

async function bootstrapGame(gameData) {
    setBase(gameData);
    setState({ 'main': { 'player': gameBase['main']['player'] } });
    setReset(false);

    // Session Saving, Restoring
    const savedDisplay = localStorage.getItem('savedDisplay');
    if (savedDisplay) setPlain(savedDisplay); display(-1);
    const savedState = localStorage.getItem('savedState');
    if (savedState) setState(JSON.parse(savedState));
    const savedScope = localStorage.getItem('savedScope');
    if (savedScope) setScope(JSON.parse(savedScope));
    addSaves();

    shell.style.display = 'flex';
    loaderPanel.style.display = 'none';

    textInput.focus();
    if (!savedDisplay) display(currentRoomBody());
    runGlobal();
}

// Game Code

function getInput(event) {
    event.preventDefault();
    setInput(textInput.value.trim().toLowerCase());
    textInput.value = '';
    textInput.focus();
    parseInput();
}
