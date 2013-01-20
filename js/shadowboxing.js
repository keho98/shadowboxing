/**
 * By Kevin Ho for CS247 P2
 * Based on code created by Michael Bernstein 2013
 */

// Student-configurable options below...
// A difference of >= SHADOW_THRESHOLD across RGB space from the background
// frame is marked as foreground
var SHADOW_THRESHOLD = 10;
// Between 0 and 1: how much memory we retain of previous frames.
// In other words, how much we let the background adapt over time to more recent frames
var BACKGROUND_ALPHA = 0.05;
// We run a gaussian blur over the input image to reduce random noise 
// in the background subtraction. Change this radius to trade off noise for precision 
var STACK_BLUR_RADIUS = 10; 
var MAX_RADIUS = 100,
    HEAD_OFFSET = 100,
    SCREAM_THRESHOLD = 40;
var JOINTS = ['HAND_RIGHT', 'HEAD', 'HAND_LEFT'];

var height = 480;
var width = 640;

var shapes = new Array(),
    silhouettes = new Array();

var index = 0;

/*
 * Begin shadowboxing code
 */
var mediaStream, video, rawCanvas, rawContext, shadowCanvas, shadowContext, background = null;
var kinect;
var JOINTS = ['HEAD','HAND_LEFT','HAND_RIGHT'];

var started = false;
var scream = false;

$(document).ready(function() {
    initializeDOMElements();
	setUpKinect();
	setUpWebCam();
    $('#background').attr('disabled', true);
    $('#background').click(function() {
        setBackground();
        if (!started) {
            renderShadow();
        }
    });
    $('canvas').click(function(){
        takeScreenshot();
    })
});

function jnt(j){ 
    return JOINTS.indexOf(j); 
}

function normalizeX(x){
    return ( ( x ) / 100 ) * width;
}

function normalizeY(y){
    return (( y) / 100 ) * height;
}

function updateShape(i){
    shapes[i].r1 += shapes[i].v_r;
}

function drawObject(ctx, obj){
    //console.log(obj.shapeType);
    ctx.beginPath();
    switch(obj.shapeType){
        case 'arc':
            ctx.arc(obj.x, obj.y, obj.r1, obj.r2, Math.PI*2, true);
            break;
    }
    if(obj.fillStyle){
        ctx.fillStyle = obj.fillStyle;
        ctx.fill();
    }
    if(obj.strokeStyle){
        ctx.strokeStyle = obj.strokeStyle;
        ctx.stroke();
    }
}
/*
 * Creates the video and canvas elements
 */
function initializeDOMElements() {
    video = document.createElement('video');
    video.setAttribute('autoplay', true);
    video.style.display = 'none';
    
    rawCanvas = document.createElement('canvas');
    rawCanvas.setAttribute('id', 'rawCanvas');
    rawCanvas.setAttribute('width', width);
    rawCanvas.setAttribute('height', height);
    rawCanvas.style.display = 'none'
    document.getElementById('capture').appendChild(rawCanvas);
    rawContext = rawCanvas.getContext('2d');
    // mirror horizontally, so it acts like a reflection
    rawContext.translate(rawCanvas.width, 0);
    rawContext.scale(-1,1);    
    
    shadowCanvas = document.createElement('canvas');
    shadowCanvas.setAttribute('id', 'shadowCanvas');
    shadowCanvas.setAttribute('width', width);
    shadowCanvas.setAttribute('height', height);
    shadowCanvas.style.display = 'block';
    document.getElementById('capture').appendChild(shadowCanvas);
    shadowContext = shadowCanvas.getContext('2d');    
}

/*
 * Starts the connection to the Kinect
 */
function setUpKinect() {
	kinect.setUp({
            players:  1,                    // # of players, max = 2
            relative    : true,             //tracking mode
            meters      : false,            //tracking mode continued
            sensitivity : 1.2,              //semsitivity
            joints:   JOINTS,               // array of joints to track
        }).sessionPersist()
		  .modal.make('css/knctModal.css')
		  .notif.make();
		  
	kinect.addEventListener('openedSocket', function() {
		console.log("Started kinect");
	});

    kinect.onMessage(function() {
        // As this function is called on every joint update, clear the canvas first.
        this.sk_len;    // # of people in the frame
        // this.coords  A 2D array[m][n] of (x, y, z) coordinates of joints.
        var d = distance(this.coords[0][jnt('HEAD')].x,this.coords[0][jnt('HAND_LEFT')].x,this.coords[0][jnt('HEAD')].y - 35,this.coords[0][jnt('HAND_LEFT')].y);
        var d2 = distance(this.coords[0][jnt('HEAD')].x,this.coords[0][jnt('HAND_RIGHT')].x,this.coords[0][jnt('HEAD')].y - 35,this.coords[0][jnt('HAND_RIGHT')].y);
        var avg = (d + d2)/2;
        if(avg < SCREAM_THRESHOLD) {
            scream = true;
        }
        else{
            scream = false;
        }
        for(var i = 0; i < JOINTS.length; i++){
            var centerX = normalizeX(this.coords[0][i].x);
            var centerY = normalizeY(this.coords[0][i].y);
            if(scream && i === jnt('HEAD')){
                shapes.push({x:centerX, y:centerY + HEAD_OFFSET, v_x:0, v_y:0,shapeType: 'arc', strokeStyle: 'rgb(0,0,200)', r1: 50, r2: 0, v_r: 20});
            }
        }
 
    });

    kinect.addEventListener('playerFound', function(args) {
        $('#demo').fadeOut();
    });

    kinect.addEventListener('playerLost', function() {   
        scream = false;
        console.log('No Players');
        $('#demo').fadeIn();
    });
}

/*
 * Starts webcam capture
 */
function setUpWebCam() {
    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
    if (!navigator.getUserMedia) { 
        console.log("Browser does not support getUserMedia. Try a latest version of Chrome/Firefox");
    }
    window.URL = window.URL || window.webkitURL;
    
    video.addEventListener('canplay', function() {
        if ($('#background').attr('disabled')) {
            $('#background').attr('disabled', false);
        }
    }, false);
    
    var failVideoStream = function(e) {
      console.log('Failed to get video stream', e);
    };
    
    navigator.getUserMedia({video: true, audio:false}, function(stream) {
        mediaStream = stream;
        
        if (navigator.mozGetUserMedia) {
          video.mozSrcObject = stream;
          video.play();
        } else {
          video.src = window.URL.createObjectURL(stream);
        }        
      }, failVideoStream);
}

/*
 * Gets an array of the screen pixels. The array is 4 * numPixels in length,
 * with [red, green, blue, alpha] for each pixel.
 */
function getCameraData() {
    if (mediaStream || kinect) {
        rawContext.drawImage(video, 0, 0, rawCanvas.width, rawCanvas.height);
        stackBlurCanvasRGB('rawCanvas', 0, 0, rawCanvas.width, rawCanvas.height, STACK_BLUR_RADIUS);        
        var pixelData = rawContext.getImageData(0, 0, rawCanvas.width, rawCanvas.height);
        //console.log(pixelData);
        return pixelData;
    }    
}

function takeScreenshot(){
    var imageData = shadowContext.getImageData(0,0, width,height);
    var destCtx = $('#grid').get(0).getContext('2d');
    var newCanvas = $("<canvas>")
        .attr("width", imageData.width)
        .attr("height", imageData.height)[0];
    var x = Math.floor(index / 4);
    var y = Math.floor(index % 4)
    newCanvas.getContext("2d").putImageData(imageData, 0, 0);
    destCtx.drawImage(newCanvas, x * width/4, y * height/4, width/4, height/4);
    index++;
}

function drawGrid(){
    var destCtx = $('#grid').get(0).getContext('2d');
    var newCanvas = $("<canvas>")
        .attr("width", imageData.width)
        .attr("height", imageData.height)[0];
    for(var i = 0; i < silhouettes.length; i++){
        var x = Math.floor(i / 4);
        var y = Math.floor(i % 4);
        newCanvas.getContext("2d").putImageData(imageData, 0, 0);
        destCtx.drawImage(newCanvas, x * width/4, y * height/4, width/4, height/4);
    }
}

/*
 * Remembers the current pixels as the background to subtract.
 */
function setBackground() {
    var pixelData = getCameraData();
    background = pixelData;
}

/*
 * In a loop: gets the current frame of video, thresholds it to the background frames,
 * and outputs the difference as a shadow.
 */
function renderShadow() {
  if (!background) {
    return;
  }
  var ctx = $('#marker').get(0).getContext('2d');
  ctx.clearRect(0, 0, width, height);
    for(var i = 0; i < shapes.length; i++){
        drawObject(ctx,shapes[i]);
        updateShape(i);
        if(shapes[i].r1 > 500){
            shapes.splice(i,i);
        }
    }
  var pixelData = getShadowData();
  shadowContext.putImageData(pixelData, 0, 0);
  setTimeout(renderShadow, 10);
}

/*
 * Returns an ImageData object that contains black pixels for the shadow
 * and white pixels for the background
 */

function getShadowData() {
    var pixelData = getCameraData();
    var randomR = getRandomInt(0,255);
    var randomG = getRandomInt(0,255);
    var randomB = getRandomInt(0,255);
    // Each pixel gets four array indices: [r, g, b, alpha]
    for (var i=0; i<pixelData.data.length; i=i+4) {
        var rCurrent = pixelData.data[i];
        var gCurrent = pixelData.data[i+1];
        var bCurrent = pixelData.data[i+2];
        
        var rBackground = background.data[i];
        var gBackground = background.data[i+1];
        var bBackground = background.data[i+2];
        		
        var distance = pixelDistance(rCurrent, gCurrent, bCurrent, rBackground, gBackground, bBackground);        
        
        if (distance >= SHADOW_THRESHOLD) {
            // foreground, show shadow
            if(scream){
                pixelData.data[i] = randomR;
                pixelData.data[i+1] = randomG;
                pixelData.data[i+2] = randomB;
            }
            else{
                pixelData.data[i] = 0;
                pixelData.data[i+1] = 0;
                pixelData.data[i+2] = 0;                
            }
        } else {
            //  update model of background, since we think this is in the background
            updateBackground(i, rCurrent, gCurrent, bCurrent, rBackground, gBackground, bBackground);
            // now set the background color
            pixelData.data[i] = 255;
            pixelData.data[i+1] = 255;
            pixelData.data[i+2] = 255;
            pixelData.data[i+3] = 0;
        }        
    }
    return pixelData; 
}

function updateBackground(i, rCurrent, gCurrent, bCurrent, rBackground, gBackground, bBackground) {
    background.data[i] = Math.round(BACKGROUND_ALPHA * rCurrent + (1-BACKGROUND_ALPHA) * rBackground);
    background.data[i+1] = Math.round(BACKGROUND_ALPHA * gCurrent + (1-BACKGROUND_ALPHA) * gBackground);
    background.data[i+2] = Math.round(BACKGROUND_ALPHA * bCurrent + (1-BACKGROUND_ALPHA) * bBackground);
}

/*
 * Returns the distance between two pixels in grayscale space
 */
function pixelDistance(r1, g1, b1, r2, g2, b2) {
    return Math.abs((r1+g1+b1)/3 - (r2+g2+b2)/3);
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function distance(x,x1,y,y1){
    return Math.sqrt((x-x1) * (x-x1) + (y-y1) * (y-y1))
}