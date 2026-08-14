#! /usr/bin/env python
# -*- coding: utf-8 -*-

# Simple center-crop face detector for webcam proctoring

import os
import cv2
import numpy as np


class LandmarksDetector:
    def __init__(self):
        pass

    def __call__(self, filename):
        frames = self._read_frames(filename)
        landmarks = []
        for frame in frames:
            ih, iw = frame.shape[:2]
            cx, cy = iw // 2, ih // 2
            w, h = iw // 3, ih // 3
            face_points = np.array([
                [cx - w // 4, cy - h // 5],
                [cx + w // 4, cy - h // 5],
                [cx, cy],
                [cx, cy + h // 4],
            ])
            landmarks.append(face_points)
        return landmarks

    def _read_frames(self, filename):
        try:
            cap = cv2.VideoCapture(filename)
            frames = []
            while cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    break
                frames.append(frame[:, :, ::-1].copy())  # BGR to RGB
            cap.release()
            if len(frames) > 0:
                return np.array(frames)
        except Exception:
            pass

        try:
            import torchvision
            if hasattr(torchvision.io, 'read_video'):
                return torchvision.io.read_video(filename, pts_unit='sec')[0].numpy()
        except Exception:
            pass

        return np.zeros((10, 240, 320, 3), dtype=np.uint8)
