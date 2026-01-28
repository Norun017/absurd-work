import {
  FaceLandmarker,
  FilesetResolver,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";

const video = document.getElementById("webcam");
const canvas = document.getElementById("output_canvas"); // For debug
const countDisplay = document.getElementById("count");

let faceLandmarker;
let blinkCount = 0;
let wasEyeClosed = false;
let onBlinkCallback = null; // Store the callback function
let stream;
let animationId; // Variable to hold the loop ID

// Initialize the detector
async function setupDetector(onBlink) {
  onBlinkCallback = onBlink; // Store callback
  const filesetResolver = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
  );
  faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
    baseOptions: {
      modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
    },
    runningMode: "VIDEO",
    numFaces: 1,
  });
  startWebcam();
}

async function startWebcam() {
  stream = await navigator.mediaDevices.getUserMedia({
    video: true,
  });
  video.srcObject = stream;
  video.addEventListener("loadeddata", predictWebcam);
}

async function predictWebcam() {
  const startTimeMs = performance.now();
  const results = await faceLandmarker.detectForVideo(video, startTimeMs);

  if (results.faceLandmarks && results.faceLandmarks.length > 0) {
    const landmarks = results.faceLandmarks[0];

    // Landmark 159: Upper Lid, 145: Lower Lid
    const eyeDist = Math.abs(landmarks[159].y - landmarks[145].y);

    // Sensitivity threshold (Adjust this if it's too sensitive)
    const threshold = 0.015;

    if (eyeDist < threshold && !wasEyeClosed) {
      wasEyeClosed = true;
    } else if (eyeDist >= threshold && wasEyeClosed) {
      // Trigger the callback when blink is detected
      if (onBlinkCallback) {
        onBlinkCallback();
      }
      wasEyeClosed = false;
    }
  }
  animationId = requestAnimationFrame(predictWebcam);
}

function stopWebCam() {
  if (stream) {
    // 1. Get all tracks (video/audio) and stop them
    const tracks = stream.getTracks();
    tracks.forEach((track) => track.stop());

    // 2. Clear the video source
    video.srcObject = null;

    // 3. (Optional) Stop the AI loop
    cancelAnimationFrame(animationId);

    console.log("Webcam stopped and hardware light turned off.");
  }
}

export { setupDetector, stopWebCam };
