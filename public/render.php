<!-- 
 Procedural Generation Project Oct 6th 
 Avery Olsen
 -->

<?php
session_start();
if (isset($_GET['reset'])) {
    session_unset();  // clear all session variables
    session_destroy(); // end the session
    header("Location: ".$_SERVER['PHP_SELF']); // reload the page cleanly
    exit;
}

if (isset($_GET['pause'])) $_SESSION['paused'] = true;
if (isset($_GET['resume'])) $_SESSION['paused'] = false;
$paused = $_SESSION['paused'] ?? false;


ob_start();

//customizable values
$renderCenter = true; // render the .cC center
$centerOffset = [0, 0]; //offset for the center in units (before gridRatio). positive = right, down
$radius = 300; // How far from the center you are
$numPoints = 20; // amount of joints
$desDist = 35; // How far away the joints are from each-other
// body size: individual points (defaults to desDist if left empty for some or all)
$bodySize = [15, 25, 35, 45, 35, 20, 25, 40, 60, 60, 60, 40, 30, 20, 15, 15, 10, 10, 10, 25, 50];
for ($i = 0; $i < count($bodySize); $i++) {
    $bodySize[$i] = intval($bodySize[$i] * 1);
}
$speed = 0.5; // refresh speed, higher is slower
$char = [' ', 'x', '·', '*']; // char for grid, joint, spine, skin
$gridRatio = 5; // intended as 5. units per grid character
$path = 'circle'; // circle, polygon
$tFrames = 50; // amount of refreshes to complete the path
$polySides = 4; // sides of polygon if $path = 'polygon'

//base values
$width = 1550; //internal width in units
$height = 750; //internal height in units
$centerX = intval($width / 2) + $centerOffset[0]; //center x unit
$centerY = intval($height / 2) + $centerOffset[1]; //center y unit
$points = []; //each joint, contains x,y, bodysize, x,y for left/right/other of body
$grid = []; //text grid, contains all text spaces (starts as all 'emptyChar')


//set points
for ($i = 0; $i < $numPoints+1; $i++) {
    $points[$i] = [
    $i * 80, $i * 80,
    (count($bodySize) > $i ? $bodySize[$i] : $desDist), //default bodysize to desdist
    0, 0, 0, 0, 0, 0 // Left side X,Y | Right side X,Y | Optional X,Y
    ];
}

// Return sessions
if (isset($_SESSION['points'])) { $points = $_SESSION['points']; }
$t = (isset($_GET['t']) ? intval($_GET['t']) : 0);

//FUNCTIONS
function initGrid() { //initalize grid of -'s
    global $centerX, $centerY, $width, $height, $grid, $gridRatio, $char, $renderCenter;
    for ($x = 0; $x < intval($width / $gridRatio); $x++) {//initialize
        for ($y = 0; $y < intval($height / $gridRatio); $y++) {
            $grid[$x][$y] = $char[0];
        }
    }
    $gCenX = intval($centerX / $gridRatio);
    $gCenY = intval($centerY / $gridRatio);
    if ($renderCenter) {
        for ($i = -2; $i < 3; $i++) for ($j = -2; $j < 3; $j++)
            $grid[$gCenX+$i][$gCenY+$j] = '.';
        for ($i = -1; $i < 2; $i++) for ($j = -1; $j < 2; $j++)
            $grid[$gCenX+$i][$gCenY+$j] = 'c';
        $grid[$gCenX][$gCenY] = 'C';
    }
}
function drawGrid() {//draw grid
    global $grid;
    echo "<pre style='font-size: 6px; line-height: 5px;".
    "letter-spacing: 1px; font-family: \"Consolas\", monospace;'>";

    for ($y = 0; $y < count($grid[0]); $y++) {
        for ($x = 0; $x < count($grid); $x++) {
            echo $grid[$x][$y];
        }
        echo "\n";
    }

    echo "</pre>";

}
function drawPoint($px, $py, $char) { //place point on grid
    global $grid, $gridRatio;
    $gx = intval($px / $gridRatio);
    $gy = intval($py / $gridRatio);
    $grid[$gx][$gy] = $char;
}
function drawLine($x1, $y1, $x2, $y2, $char) {
    $vect = vector($x2, $y2, $x1, $y1); // make and normalize vector
    $dist = distance($vect[0], $vect[1]);
    $vect = normalize($vect[0], $vect[1]);
    $vX = $vect[0]; $vY = $vect[1];

    for ($i = 0; $i < intval($dist); $i+=3) {
        $lx = $x1 + $vX * $i;
        $ly = $y1 + $vY * $i;
        drawPoint($lx, $ly, $char);
    }
}
function polygon($cx, $cy, $radius, $sides) {
    $points = [];
    for ($i = 0; $i < $sides; $i++) {
        $angle = (2 * M_PI * $i) / $sides - M_PI_2;
        $points[] = [$cx + cos($angle) * $radius, $cy + sin($angle) * $radius];
    }
    return $points;
}
function vector($toX, $toY, $fromX, $fromY) { //Make vector from location to another
    $vectX = $toX - $fromX;
    $vectY = $toY - $fromY;
    return [$vectX, $vectY];
}
function distance($dx, $dy) {
    $dist = sqrt(pow($dx, 2) + pow($dy, 2));
    return $dist;
}
function normalize($vectX, $vectY) { //Set vector length to 1 (unit vector)
    $vectL = distance($vectX, $vectY);
    if ($vectL != 0) {
        $vectX /= $vectL;
        $vectY /= $vectL;
    } else {
        $vectX = 0;
        $vectY = 0;
    }
    return [$vectX, $vectY];
}
function pull($pNum) {  //pull point to other
    global $points, $desDist;
    $pull =& $points[$pNum];    //Set pulled var, x, y, size
    $pX = $pull[0]; $pY = $pull[1]; $pS = $pull[2];

    $anchor = $points[$pNum-1];     //Set anchor var, x, y
    $aX = $anchor[0]; $aY = $anchor[1];

    $vect = vector($pX, $pY, $aX, $aY);     //Unit vector from pull to anchor
    $vect = normalize($vect[0], $vect[1]);
    $vX = $vect[0]; $vY = $vect[1];
    $pX = $aX + $vX * $desDist; $pY = $aY + $vY * $desDist;

    // set middle x, y, left x, y, right x, y side points
    $pull[0] = $pX; $pull[1] = $pY;
    $pull[3] = $pX + (-$vY * $pS); $pull[4] = $pY + ( $vX * $pS);
    $pull[5] = $pX + ( $vY * $pS); $pull[6] = $pY + (-$vX * $pS);

    if ($pNum == 1) {              // set head 
        $pull[7] = $pX + (-$vX * $pS); $pull[8] = $pY + (-$vY * $pS); }
    if ($pNum == count($points)-1) {  // set tail
        $pull[7] = $pX + ( $vX * $pS); $pull[8] = $pY + ( $vY * $pS); }
}
function moveOnPath(&$anchor) {
    global $t, $tFrames, $centerX, $centerY, $radius, $path, $polySides;
    $progress = ($t % $tFrames) / $tFrames;
    if ($path == 'circle') {
        $angle = $progress * 2 * M_PI;
        $anchor[0] = $centerX + ($radius * cos($angle));
        $anchor[1] = $centerY + ($radius * sin($angle));
    } else if ($path == 'polygon') {
        $polygon = polygon($centerX, $centerY, $radius, $polySides);

        $edgeProgress = $progress * $polySides;
        $floorEdge = floor($edgeProgress);
        $sideProgress = $edgeProgress - $floorEdge; // (0.54 = 54% along an edge)

        $p1 = $polygon[$floorEdge % $polySides];
        $p2 = $polygon[($floorEdge + 1) % $polySides];

        $anchor[0] = $p1[0] + ($p2[0] - $p1[0]) * $sideProgress;
        $anchor[1] = $p1[1] + ($p2[1] - $p1[1]) * $sideProgress;
    }
}

//////////
// CODE

initGrid();
moveOnPath($points[0], $path);

//set anchor to circle

for ($i = 1; $i < count($points); $i++)
    pull($i);
for ($i = 2; $i < count($points); $i++)
    drawLine($points[$i][0], $points[$i][1], $points[$i-1][0], $points[$i-1][1], $char[2]);


for ($i = 2; $i < count($points); $i++) {
    drawLine($points[$i][3], $points[$i][4], $points[$i-1][3], $points[$i-1][4], $char[3]);
    drawLine($points[$i][5], $points[$i][6], $points[$i-1][5], $points[$i-1][6], $char[3]);
}
//draw head/tail
$head = $points[1]; $tail = $points[count($points)-1];
drawLine($head[3], $head[4], $head[7], $head[8], $char[3]);
drawLine($head[5], $head[6], $head[7], $head[8], $char[3]);
drawLine($tail[3], $tail[4], $tail[7], $tail[8], $char[3]);
drawLine($tail[5], $tail[6], $tail[7], $tail[8], $char[3]);

for ($i = 1; $i < count($points); $i++)
    drawPoint($points[$i][0], $points[$i][1], $char[1]);

drawGrid();


$_SESSION['points'] = $points;
$nextT = $t + 1;
usleep($speed * 100000);
if (!$paused)
echo ("<meta http-equiv='refresh' content='0.1; URL=?t=".$nextT."'>");

echo "<div style='font-family: Consolas; margin-top:10px;'>";
echo $paused
    ? "<a href='?resume=1'>Resume</a> "
    : "<a href='?pause=1'>Pause</a> ";
echo "<a href='?reset=1'> Reset</a>";
echo "</div>";

ob_end_flush();