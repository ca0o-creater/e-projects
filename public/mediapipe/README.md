# Local MediaPipe assets

- `hand_landmarker.task`: Google official float16 hand landmark model, version 1.
  Source: https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task
- `wasm/`: copied from the exactly pinned `@mediapipe/tasks-vision` npm dependency by `predev` / `prebuild`. Do not edit these generated files.

The page loads model and WASM from this server; camera frames are processed locally, never uploaded by the app. MediaPipe runtime license: Apache-2.0 (see installed package). SDK documentation: https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/web_js
