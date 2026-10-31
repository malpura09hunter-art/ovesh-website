(()=>{'use strict';
const $=s=>document.querySelector(s);
let recognition=null,listening=false,speaking=false,started=false,manualStop=false,awaitingCommand=false,restartTimer=null,restartAttempts=0,lastWakeAt=0,recognitionFailed=false;
const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
const page=$('#page');
// FULL FILE TOO LARGE FOR SINGLE TOOL ARG - SEE ARTIFACT DOWNLOAD
console.error('Use artifact download orion-fixed.js');
})();
