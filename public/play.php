<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Narrascript Game</title>
    <link rel="stylesheet" href="play.css">
</head>
<body>

<?php
session_start();
if (isset($_GET['reset'])) {
    session_unset();  // clear all session variables
    session_destroy(); // end the session
    header("Location: ".$_SERVER['PHP_SELF']); // reload the page cleanly
    exit;
}

// COMMAND LOGIC
function parseInput() {
    global $input, $cursor;
    if (!empty($input)) {
        display('> '.$input);
        $input = explode(' ', $input);
        resolveCommand($input);
    }
    if (isset($cursor['@effects']) && !empty($cursor['@effects'])) runEffects($cursor['@effects']);
}
function resolveCommand($input) {
    global $cursor;
    for ($i = 0; $i < count($input); $i++) {
        if (isset($cursor[$input[$i]])) {
            $cursor = $cursor[$input[$i]];
        } else if (isset($cursor['default'])) {
            $cursor = $cursor['default'];
            break;
        } else {
            display(retrieve('player/@unusable-command'));
            $cursor = retrieve('commands');
            break;
        }
    }
    // use default if nothing available
    if (!isset($cursor['@effects']) && isset($cursor['default'])) {
        $cursor = $cursor['default'];
    }
}
function runEffects($effects) {
    //allow comments
    $effects = preg_replace('/\/\/.*$/m', '', $effects);
    $effectVars = [];

    $length = strlen($effects);
    $i = 0;
    $currentCall = '';

    for ($i = 0; $i < $length; $i++) {
        $char = $effects[$i];

        // Run a complete call
        if ($char === ';') {
            runCall(trim($currentCall), $effectVars);
            $currentCall = '';
        } elseif ($char === '{') {
            // Block start
            $block = getBlock($i, $effects);
            $ifBlock = substr($effects, $block['start'], $block['end'] - $block['start']);
            $i = $block['end'];

            $elseBlock = null;
            //Check for else
            $afterIf = trim(substr($effects, $i + 1));
            if (strpos($afterIf, "else") === 0) {
                $block = getBlock(strpos($afterIf, '{') + $i + 2, $effects);
                $elseBlock = substr($effects, $block['start'], $block['end'] - $block['start']);
                $i = $block['end'];
            }

            // currentCall is the if, ifBlock is the block
            runCall(trim($currentCall), $effectVars, $ifBlock, $elseBlock);
            $currentCall = '';
        } else $currentCall .= $char; // keep adding
    }

    if (!empty(trim($currentCall))) runCall(trim($currentCall), $effectVars);
}

function getBlock($cursor, $string) {
    $block = [];
    $block['start'] = $cursor + 1;
    $braceCount = 1;
    $cursor++;
    while ($cursor < strlen($string) && $braceCount > 0) {
        if ($string[$cursor] === '{') $braceCount++;
        if ($string[$cursor] === '}') $braceCount--;
        $cursor++;
    }
    $block['end'] = $cursor - 1;
    return $block;
}

function runCall($call, &$effectVars, $block = null, $elseBlock = null) {
    if (!validateCall($call, $block, $elseBlock)) return;

    if (strpos($call, 'if(') === 0) { // Condition call
        // Extract condition
        $condStart = strpos($call, '(') + 1;
        $condEnd = strrpos($call, ')');
        $condition = substr($call, $condStart, $condEnd - $condStart);
        // Call is now if(THIS)

        if (evaluateCondition($condition, $effectVars)) {
            // Recursively run the block if condition passes
            runEffects($block);
        } elseif ($elseBlock !== null) {
            runEffects($elseBlock);
        }
    } else { // Normal call

        $callName = explode('(', $call)[0];
        $args = explode('(', $call)[1];
        $args = evaluateArgs(rtrim($args, ')'), $effectVars);

        switch ($callName) {
            case "display":
                display($args, $effectVars);
                break;
            case "move":
                move($args, $effectVars);
                break;
            case "var":
                varSet($args, $effectVars);
                break;
            case "add_item":
                addItem($args, $effectVars);
                break;
            case "delete_item":
                deleteItem($args, $effectVars);
                break;
            default:
                error(3, "Unknown effect call '".$callName."'");
        }
    }
}
function evaluateCondition($condition, $effectVars) {
    global $gameState;
    $condition = trim($condition);

    //base parser
    if (preg_match('/^([a-zA-Z_]+)\((.*)\)$/', $condition, $parts)) { // parts[1](parts[2])
        $call = $parts[1];
        $args = $parts[2];
        // $call($args)

        $args = splitArgs($args);
        $evalArgs = [];
        foreach ($args as $a) {
            $evalArgs[] = evaluateCondition($a, $effectVars);
        } // evaluate all args

        switch ($call) {
            case "and":
                requireArgs(2, 'and', $evalArgs);
                return $evalArgs[0] && $evalArgs[1];
            case "or":
                requireArgs(2, 'or', $evalArgs);
                return $evalArgs[0] || $evalArgs[1];
            case "xor":
                requireArgs(2, 'xor', $evalArgs);
                return $evalArgs[0] xor $evalArgs[1];
            case "not":
                requireArgs(1, 'not', $evalArgs);
                return !$evalArgs[0];
            case "greater":
                requireArgs(2, 'greater', $evalArgs);
                return intval($evalArgs[0]) > intval($evalArgs[1]);
            case "equals":
                requireArgs(2, 'equals', $evalArgs);
                return $evalArgs[0] === $evalArgs[1];
            case "isset": 
                requireArgs(1, 'isset', $evalArgs);
                $value = getVar($evalArgs[0], $effectVars);
                return isset($value) && !empty($value);
            case "has_item":
                requireArgs(1, 'has_item', $evalArgs);
                return hasItem($evalArgs[0]);
            default:
                error(4, "Cannot understand condition '".$call."'");
        }
    }

    if (strpos($condition, '#')) return getVar($condition, $effectVars) > 0;
    return $condition;
}
function splitArgs($string) {
    $depth = 0;
    $args = [];
    $currentArg = '';

    for ($i = 0; $i < strlen($string); $i++) {
        $char = $string[$i];
        if ($char === '(') $depth++;
        if ($char === ')') $depth--;
        if ($char === ',' && $depth === 0) {
            $args[] = trim($currentArg);
            $currentArg = '';
        } else {
            $currentArg .= $char;
        }
    }
    if (strlen(trim($currentArg))) $args[] = trim($currentArg);
    return $args;
}
function evaluateArgs($string, $effectVars) {
    $argArray = explode(',', $string);
    for ($i = 0; $i < count($argArray); $i++)
        $argArray[$i] = parseValue(trim($argArray[$i]), $effectVars);
    return $argArray;
}

//VARIABLES
function retrieve($path) {
    global $game, $gameState;
    $parts = explode('/', $path);

    // look in $game
    $value = $game;
    foreach ($parts as $p) {
        if (!isset($value[$p])) { $value = null; break; }
        $value = $value[$p];
    }

    // look in $gameState
    $stateValue = $gameState;
    foreach ($parts as $p) {
        if (!isset($stateValue[$p])) { $stateValue = null; break; }
        $stateValue = $stateValue[$p];
    }

    return ($stateValue === null ? $value : $stateValue);
}
function getVar($var, $effectVars) {
    if (!isset($effectVars[$var])) return '';
    if (strpos($var, "#") === 0)
        return intval($effectVars[$var]);
    return $effectVars[$var];
}
function parseValue($value, $effectVars) {
    $result = '';
    $var = '';
    $inVar = false;

    for ($i = 0; $i < strlen($value); $i++) {

        $char = $value[$i];

        if ($char === '$' || $char === '#')
            if (isset($value[$i+1]) && $char === $value[$i+1]) {
                $result .= $char;
                $i++;
            } else
                $inVar = true;

        if ($inVar) {
            $var .= $char;
            if (isset($effectVars[$var])) {
                $result .= getVar($var, $effectVars);
                $var = '';
                $inVar = false;
            }
            continue;
        }

        $result .= $char;

    }
    if ($inVar) error(5, "Variable '".$var."' does not exist");

    return $result;
}

function setVars() {
    global $game, $cursor, $input, $gameState;
    $game = json_decode(file_get_contents('game.json'), true);
    $cursor = $game['commands'];
    $input = (isset($_POST['input']) ? $_POST['input'] : []);

    if (!isset($_SESSION['gameState'])) $_SESSION['gameState'] = [];
    $gameState = $_SESSION['gameState'];
    $gameState['display'] = ($_SESSION['gameState']['display'] ?? str_repeat('<br>', 30));
    $gameState['player']['@room'] = ($_SESSION['gameState']['player']['@room'] ?? '');
    if (empty($gameState['player']['@room'])) move('room_cell');
}

// CALLS
function display($args, $effectVars = []) {
    // display(val Text);
    global $gameState;
    if (!is_array($args)) $args = [$args];
    requireArgs(1, 'display', $args,);
    $text = $args[0];
    $gameState['display'] .= "<br><br>".htmlspecialchars($text);
}
function move($args, $effectVars = []) {
    // move(val Room);
    global $gameState;
    if (!is_array($args)) $args = [$args];
    requireArgs(1, 'move', $args);
    $room = $args[0];
    $gameState['player']['@room'] = $room;
    display(retrieve('rooms/'.$gameState['player']['@room'].'/@body'));
}
function varSet($args, &$effectVars) {
    // var(val Var, val Val);
    requireArgs(2, 'var', $args);
    $effectVars[$args[0]] = $args[1];
}
function addItem($args, $effectVars) {
    global $gameState;
    // add_item(val Item);
    requireArgs(1, 'add_item', $args);
    $item = $args[0];
    $inv = retrieve('player/@inventory');
    if ($inv === '') $gameState['player']['@inventory'] = $item;
    else $gameState['player']['@inventory'] = $inv.', '.$item;
}
function deleteItem($args, $effectVars) {
    global $gameState;
    // delete_item(val Item);
    requireArgs(1, 'delete_item', $args);
    $item = $args[0];
    $inv = retrieve('player/@inventory');
    $pos = strpos($inv, $item);
    if ($pos === false) error(7, "Item '".$item."' not found in inventory");
    elseif ($pos === 0) $gameState['player']['@inventory'] = substr($inv, strlen($item)+2);
    else $gameState['player']['@inventory'] = str_replace(', '.$item, '', $inv, 1);
}

//CONDITION CALLS
function hasItem($item) {
    $items = explode(', ', retrieve('player/@inventory'));
    foreach ($items as $i) {
        if ($i === $item) return true;
    }
    return false;
}

//ERROR HANDLING
function requireArgs($amount, $call, $args, $greedy = false) {
    if ((count($args) != $amount) &&
        !(count($args) > $amount && $greedy))
        error(0, "Call '".$call.
            "' expected ".$amount.' arguments, found '.count($args).'.');
}
function validateCall($call, $block, $elseBlock) {
    if (strpos($call, 'if(') === 0 && $block === null) { // If but no block
        error(1, "Call '".$call."' contains no block, { expected");
        return false;
    }
    if (strpos($call, 'else') === 0 && $elseBlock === null) { // Else but no block
        error(1, "Call '".$call."' contains no block, { expected");
        return false;
    } else
    if (strpos($call, '(') === false) {
        error(2, "Call '".$call."' missing (");
        return false;
    }
    return true;
}
function error($code, $reason) {
    global $gameState;
    $gameState['display'] .= "<br><br>".'<strong>[ERROR]</strong> Code '.$code.': '.$reason;
}


//PHP LOOP
setVars();

parseInput();

$_SESSION['gameState'] = $gameState;
?>

<!-- HTML -->
<div id="display"><?php echo $gameState['display']; ?></div>

<form action="" method="post">
    <input type="text" id="input" name="input" placeholder="type here!">
</form>
<a href='?reset=1'> Reset</a>

<!-- JAVASCRIPT -->
<script>
window.onload = function() {
  const input = document.getElementById("input");
  const display = document.getElementById("display");
  display.scrollTop = display.scrollHeight; // jump to bottom
  input.focus(); // refocus for next command
};
</script>


</body>
</html>