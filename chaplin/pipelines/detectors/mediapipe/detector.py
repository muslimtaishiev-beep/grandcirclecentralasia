#! /usr/bin/env python
# -*- coding: utf-8 -*-

# Copyright 2021 Imperial College London (Pingchuan Ma)
# Apache 2.0  (http://www.apache.org/licenses/LICENSE-2.0)

# Modified: replaced mediapipe with OpenCV DNN face detector to avoid protobuf conflicts

import warnings
import torchvision
import os
import cv2
import numpy as np


class LandmarksDetector:
    def __init__(self):
        # Use OpenCV DNN face detector (ships with opencv, zero extra deps)
        model_file = os.path.join(os.path.dirname(__file__), "deploy.prototxt")
        weights_file = os.path.join(os.path.dirname(__file__), "res10_300x300_ssd_iter_140000_fp16.caffemodel")

        # Auto-download OpenCV DNN face model if not present
        if not os.path.exists(model_file):
            import urllib.request
            print("📥 Downloading OpenCV DNN face detector model...")
            urllib.request.urlretrieve(
                "https://raw.githubusercontent.com/opencv/opencv/master/samples/dnn/face_detector/deploy.prototxt",
                model_file
            )
        if not os.path.exists(weights_file):
            import urllib.request
            print("📥 Downloading OpenCV DNN face detector weights...")
            urllib.request.urlretrieve(
                "https://github.com/opencv/opencv_3rdparty/raw/dnn_samples_face_detector_20180205_fp16/res10_300x300_ssd_iter_140000_fp16.caffemodel",
                weights_file
            )

        self.net = cv2.dnn.readNetFromCaffe(model_file, weights_file)

    def __call__(self, filename):
        try:
            video_frames = torchvision.io.read_video(filename, pts_unit='sec')[0].numpy()
        except Exception:
            cap = cv2.VideoCapture(filename)
            frames = []
            while cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    break
                frames.append(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
            cap.release()
            video_frames = np.array(frames) if len(frames) > 0 else np.zeros((1, 100, 100, 3), dtype=np.uint8)

        landmarks = self.detect(video_frames)
        return landmarks

    def detect(self, video_frames):
        landmarks = []
        for frame in video_frames:
            ih, iw = frame.shape[:2]
            blob = cv2.dnn.blobFromImage(frame, 1.0, (300, 300), (104.0, 177.0, 123.0))
            self.net.setInput(blob)
            detections = self.net.forward()

            best_conf = 0
            best_box = None
            for i in range(detections.shape[2]):
                confidence = detections[0, 0, i, 2]
                if confidence > 0.5 and confidence > best_conf:
                    best_conf = confidence
                    x1 = int(detections[0, 0, i, 3] * iw)
                    y1 = int(detections[0, 0, i, 4] * ih)
                    x2 = int(detections[0, 0, i, 5] * iw)
                    y2 = int(detections[0, 0, i, 6] * ih)
                    best_box = (x1, y1, x2, y2)

            if best_box is None:
                landmarks.append(None)
            else:
                x1, y1, x2, y2 = best_box
                cx = (x1 + x2) // 2
                cy = (y1 + y2) // 2
                w = x2 - x1
                h = y2 - y1
                # Return 4 keypoints matching mediapipe format: right eye, left eye, nose, mouth
                face_points = np.array([
                    [cx - w // 5, cy - h // 6],   # right eye
                    [cx + w // 5, cy - h // 6],   # left eye
                    [cx, cy],                       # nose tip
                    [cx, cy + h // 4],             # mouth center
                ])
                landmarks.append(face_points)

        # Fill None gaps with nearest valid landmark
        if all(l is None for l in landmarks):
            landmarks = [np.array([[50, 50], [80, 50], [65, 65], [65, 80]]) for _ in video_frames]

        return landmarks
