const previousEl = document.getElementById("previous");
const currentEl = document.getElementById("current");
const buttons = document.querySelectorAll(".btn");

// Raw expression stored for calculation (uses *, /, +, -, functions like sin( )
let expression = "";
let lastResult = null;

// -------------------- Pretty display (Feature 10) --------------------
function formatForDisplay(raw) {
  if (!raw) return "0";

  return raw
    .replaceAll("*", "×")
    .replaceAll("/", "÷")
    .replaceAll("pi", "π")
    .replaceAll("sqrt(", "√(")
    .replaceAll("pow2(", "x²(");
}

function updateDisplay() {
  currentEl.textContent = formatForDisplay(expression);
}

// -------------------- Helpers --------------------
function isOperator(ch) {
  return ["+", "-", "*", "/"].includes(ch);
}

function endsWithFunctionStart() {
  // last few chars match any "sin(", "cos(", etc.
  return (
    expression.endsWith("sin(") ||
    expression.endsWith("cos(") ||
    expression.endsWith("tan(") ||
    expression.endsWith("sqrt(") ||
    expression.endsWith("log(") ||
    expression.endsWith("ln(") ||
    expression.endsWith("pow2(")
  );
}

function canAddOperator(op) {
  if (!expression.length) return op === "-"; // allow starting negative
  const last = expression[expression.length - 1];
  if (isOperator(last) || last === "." || last === "(") return false;
  if (endsWithFunctionStart()) return false;
  return true;
}

function canAddDot() {
  // check current number chunk after last operator or "("
  let i = expression.length - 1;
  while (i >= 0 && !isOperator(expression[i]) && expression[i] !== "(") i--;
  const currentNumber = expression.slice(i + 1);
  return !currentNumber.includes(".");
}

function clearAll() {
  expression = "";
  lastResult = null;
  previousEl.textContent = "";
  updateDisplay();
}

function deleteOne() {
  // delete one char, but if we ended with a function token, remove whole token
  const tokens = ["sin(", "cos(", "tan(", "sqrt(", "log(", "ln(", "pow2("];
  for (const t of tokens) {
    if (expression.endsWith(t)) {
      expression = expression.slice(0, -t.length);
      updateDisplay();
      return;
    }
  }
  expression = expression.slice(0, -1);
  updateDisplay();
}

function percent() {
  if (!expression.length) return;

  try {
    // apply % to last number segment
    let i = expression.length - 1;
    while (i >= 0 && !isOperator(expression[i]) && expression[i] !== "(") i--;
    const left = expression.slice(0, i + 1);
    const numStr = expression.slice(i + 1);
    if (!numStr || numStr === "." || numStr === ")") return;

    const num = parseFloat(numStr);
    if (Number.isNaN(num)) return;

    expression = left + (num / 100).toString();
    updateDisplay();
  } catch {
    currentEl.textContent = "Error";
    expression = "";
  }
}

// -------------------- Scientific evaluation (Feature 8) --------------------
// Use DEGREE-based trig (more user friendly)
function sind(x) { return Math.sin((x * Math.PI) / 180); }
function cosd(x) { return Math.cos((x * Math.PI) / 180); }
function tand(x) { return Math.tan((x * Math.PI) / 180); }

function safeEvaluate(raw) {
  // allow digits, operators, dot, spaces, parentheses, and letters for functions/constants
  if (!/^[0-9+\-*/. ()a-z]+$/i.test(raw)) throw new Error("Invalid chars");

  const trimmed = raw.trim();
  if (!trimmed) throw new Error("Empty");

  // prevent ending with operator or dot or function start
  const last = trimmed[trimmed.length - 1];
  if (isOperator(last) || last === "." || endsWithFunctionStart()) throw new Error("Incomplete");

  // Replace tokens with safe JS (Math + our degree trig)
  // Constants
  let exp = trimmed
    .replaceAll("pi", "Math.PI")
    .replaceAll("e", "Math.E");

  // Functions
  exp = exp
    .replaceAll("sqrt(", "Math.sqrt(")
    .replaceAll("log(", "Math.log10(")
    .replaceAll("ln(", "Math.log(")
    .replaceAll("pow2(", "Math.pow("); // We'll convert pow2(x) to Math.pow(x,2) with a trick below

  // Trick to handle pow2( something ):
  // We convert: Math.pow( <expr>  into: Math.pow(<expr>,2)
  // by inserting ",2" before the matching closing ')'
  // We'll do a simple bracket counter scan.
  exp = convertPow2(exp);

  // trig in degrees
  exp = exp
    .replaceAll("sin(", "sind(")
    .replaceAll("cos(", "cosd(")
    .replaceAll("tan(", "tand(");

  // Evaluate in a strict scope with only allowed helpers
  const fn = Function(
    `"use strict";
     const sind = ${sind.toString()};
     const cosd = ${cosd.toString()};
     const tand = ${tand.toString()};
     return (${exp});`
  );

  const result = fn();
  if (!Number.isFinite(result)) throw new Error("Math error");
  return result;
}

// Convert "Math.pow(<inside>)" that came from "pow2(" into "Math.pow(<inside>,2)"
function convertPow2(exp) {
  // exp contains "Math.pow(" where we need to add ",2" at correct closing bracket
  let out = "";
  for (let i = 0; i < exp.length; i++) {
    if (exp.startsWith("Math.pow(", i)) {
      out += "Math.pow(";
      i += "Math.pow(".length; // now i points to first char inside
      let depth = 1;
      let inner = "";
      for (; i < exp.length; i++) {
        const ch = exp[i];
        if (ch === "(") depth++;
        if (ch === ")") depth--;
        if (depth === 0) break;
        inner += ch;
      }
      out += inner + ",2)";
    } else {
      out += exp[i];
    }
  }
  return out;
}

function equals() {
  if (!expression.length) return;

  try {
    const result = safeEvaluate(expression);
    previousEl.textContent = formatForDisplay(expression) + " =";
    expression = result.toString();
    lastResult = result;
    updateDisplay();
  } catch {
    previousEl.textContent = formatForDisplay(expression);
    currentEl.textContent = "Error";
    expression = "";
    lastResult = null;
  }
}

// -------------------- Input adding --------------------
function addValue(val) {
  // if last op was result and user types number/dot/function/constant => new calc
  if (lastResult !== null && (/^[0-9.]$/.test(val) || /[a-z]/i.test(val))) {
    previousEl.textContent = "";
    expression = "";
    lastResult = null;
  }

  if (isOperator(val)) {
    if (!canAddOperator(val)) return;
    expression += val;
    updateDisplay();
    return;
  }

  if (val === ".") {
    if (!expression.length) {
      expression = "0.";
      updateDisplay();
      return;
    }
    if (!canAddDot()) return;
    expression += ".";
    updateDisplay();
    return;
  }

  // numbers / parentheses / letters
  expression += val;
  updateDisplay();
}

function insertToken(token) {
  // tokens like "sin(", "sqrt(", "pi", "(" etc.
  if (lastResult !== null) {
    // if a function/constant is added after result, start new
    previousEl.textContent = "";
    expression = "";
    lastResult = null;
  }
  expression += token;
  updateDisplay();
}

// -------------------- Button clicks --------------------
buttons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const value = btn.dataset.value;
    const action = btn.dataset.action;
    const insert = btn.dataset.insert;

    if (action === "clear") return clearAll();
    if (action === "delete") return deleteOne();
    if (action === "equals") return equals();
    if (action === "percent") return percent();

    if (insert) return insertToken(insert);
    if (value) return addValue(value);
  });
});

// -------------------- Keyboard highlight (Feature 9) --------------------
function flashButton(matchFn) {
  const btn = Array.from(buttons).find(matchFn);
  if (!btn) return;

  btn.classList.add("key-active");
  setTimeout(() => btn.classList.remove("key-active"), 120);
}

document.addEventListener("keydown", (e) => {
  const key = e.key;

  // digits
  if (key >= "0" && key <= "9") {
    addValue(key);
    flashButton(b => b.dataset.value === key);
    return;
  }

  // dot
  if (key === ".") {
    addValue(".");
    flashButton(b => b.dataset.value === ".");
    return;
  }

  // operators
  if (["+", "-", "*", "/"].includes(key)) {
    addValue(key);
    flashButton(b => b.dataset.value === key);
    return;
  }

  // Enter / =
  if (key === "Enter" || key === "=") {
    e.preventDefault();
    equals();
    flashButton(b => b.dataset.action === "equals");
    return;
  }

  // Backspace => DEL
  if (key === "Backspace") {
    deleteOne();
    flashButton(b => b.dataset.action === "delete");
    return;
  }

  // Escape => AC
  if (key === "Escape") {
    clearAll();
    flashButton(b => b.dataset.action === "clear");
    return;
  }

  // Optional: type '(' or ')'
  if (key === "(" || key === ")") {
    addValue(key);
    flashButton(b => b.dataset.insert === key);
    return;
  }
});

updateDisplay();