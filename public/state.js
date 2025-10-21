/*

Narrascript State File (./public/state.js)
Last updated 10/21/25 by Avery Olsen

State JavaScript file; Stores global states; initialization function
Made to decrease amount of variables passed through functions

*/

// Core Variables

export let gameBase = {};
export let gameState = {};
export let scope = [{}];
export let runtimeError = '';
export let displayDiv;
export let input;
export let inReset = false;

// Core Setters

export function setBase(newBase) {
    gameBase = newBase;
}
export function setState(newState) {
  gameState = newState;
}
export function setScope(newScope) {
  scope = newScope;
}
export function setError(error) {
  runtimeError = error;
}
export function setInput(str) {
  input = str;
}
export function setDisplay(dis) {
    displayDiv = dis;
}
export function setReset(bool = true) {
    inReset = bool;
}