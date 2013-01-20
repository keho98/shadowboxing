/**
 * Shadowboxing: CS 247 P2
 * -----------------------
 * Questions go to Piazza: https://piazza.com/stanford/winter2013/cs247/home
 * Performs background subtraction on a webcam or kinect driver to identify
 * body outlines. Relies on HTML5: <video> <canvas> and getUserMedia().
 * Feel free to configure the constants below to your liking.
 * 
 * Created by Michael Bernstein 2013
 */

// Student-configurable options below...

// show the after-gaussian blur camera input
SHOW_RAW = false;
// show the final shadow
SHOW_SHADOW = true;
// input option: kinectdepth (kinect depth sensor), kinectrgb (kinect camera), 
// or webcam (computer camera)
var INPUT = "webcam"; 
// A difference of >= SHADOW_THRESHOLD across RGB space from the background
// frame is marked as foreground
var SHADOW_THRESHOLD = 10;
// Between 0 and 1: how much memory we retain of previous frames.
// In other words, how much we let the background adapt over time to more recent frames
var BACKGROUND_ALPHA = 0.05;
// We run a gaussian blur over the input image to reduce random noise 
// in the background subtraction. Change this radius to trade off noise for precision 
var STACK_BLUR_RADIUS = 10; 
var JOINTS = ['HAND_RIGHT', 'HEAD', 'HAND_LEFT'];

var jnt = function(j) { return JOINTS.indexOf(j); }

/*
 * Begin shadowboxing code
 */
var mediaStream, video, rawCanvas, rawContext, shadowCanvas, shadowContext, background = null;
var kinect, kinectSocket = null;
var JOINTS = ['HEAD','HAND_LEFT','HAND_RIGHT'];

var canvas,ctx;
var started = false;
var scream = false;

$(document).ready(function() {
    initializeDOMElements();
    $("#background").attr('disabled', true);
	setUpKinect();
	setUpWebCam();
    canvas = document.getElementById('jointTracker');
    ctx = canvas.getContext('2d');
    $('#background').click(function() {
        setBackground();
        if (!started) {
            renderShadow();
        }
    });
});

/*
 * Creates the video and canvas elements
 */
function initializeDOMElements() {
    video = document.createElement('video');
    video.setAttribute('autoplay', true);
    video.style.display = 'none';
    
    rawCanvas = document.createElement('canvas');
    rawCanvas.setAttribute('id', 'rawCanvas');
    rawCanvas.setAttribute('width', 640);
    rawCanvas.setAttribute('height', 480);
    rawCanvas.style.display = 'none'
    document.getElementById('capture').appendChild(rawCanvas);
    rawContext = rawCanvas.getContext('2d');
    // mirror horizontally, so it acts like a reflection
    rawContext.translate(rawCanvas.width, 0);
    rawContext.scale(-1,1);    
    
    shadowCanvas = document.createElement('canvas');
    shadowCanvas.setAttribute('id', 'shadowCanvas');
    shadowCanvas.setAttribute('width', 640);
    shadowCanvas.setAttribute('height', 480);
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
		startKinect();
	});

    kinect.onMessage(function() {
        // As this function is called on every joint update, clear the canvas first.
        this.sk_len;    // # of people in the frame
        this.coords;    // A 2D array[m][n] of (x, y, z) coordinates of joints.
        var d = distance(this.coords[0][jnt('HEAD')].x,this.coords[0][jnt('HAND_LEFT')].x,this.coords[0][jnt('HEAD')].y - 35,this.coords[0][jnt('HAND_LEFT')].y);
        var d2 = distance(this.coords[0][jnt('HEAD')].x,this.coords[0][jnt('HAND_RIGHT')].x,this.coords[0][jnt('HEAD')].y - 35,this.coords[0][jnt('HAND_RIGHT')].y);
        var avg = (d + d2)/2;
        console.log(avg);
        if(avg < 40){
            scream = true;
        }
        else scream = false;
        // for(var i = 0; i < JOINTS.length; i++){
        //     var centerX = this.coords[0][i].x;
        //     var centerY = this.coords[0][i].y;
        //     ctx.beginPath();
        //     ctx.arc(normalizeX(centerX),normalizeY(centerY), 10, 0, 2 * Math.PI, false);
        //     if(scream) {
        //         ctx.fillStyle = 'red';
        //     }
        //     else{
        //         ctx.fillStyle = 'blue'
        //     }
        //     ctx.fill(); 
        // }
    });

    kinect.addEventListener('playerFound', function(args) {
        //Stop loop
    });

    kinect.addEventListener('noPlayers', function() {   
        //Show loop
    });
}

/*
 * Starts the socket for depth or RGB messages from KinectSocketServer
 */
function startKinect() {	
	if(kinectSocket)
	{
		kinectSocket.send( "KILL" );
		setTimeout(function() {
			kinectSocket.close();
			kinectSocket.onopen = kinectSocket.onmessage = kinectSocket = null;
		}, 300 );
		return false;
	}
	
	// Web sockets
	kinectSocket = kinect.makeRGB(null, true, null);

	kinectSocket.onopen = function() {
	};
	
	kinectSocket.onclose = kinectSocket.onerror = function() {
		kinectSocket.onclose = kinectSocket.onerror = null;
		return false;
	};

	kinectSocket.onmessage = function( e ) {
		if (e.data.indexOf("data:image/jpeg") == 0) {
			var image = new Image();
			image.src = e.data;
			image.onload = function() {
				rawContext.drawImage(image, 0, 0, 640, 480);
			}
            console.log("Doing thangs")
			return false;
		}
	};
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
  
  pixelData = getShadowData();
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
            // background
            
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