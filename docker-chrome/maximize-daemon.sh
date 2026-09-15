#!/bin/sh
export DISPLAY=:0
while true; do
    WID=$(xdotool search --onlyvisible --class chromium 2>/dev/null | head -n 1)
    if [ -n "$WID" ]; then
        xdotool windowmove "$WID" 0 0 2>/dev/null || true
        xdotool windowsize "$WID" 1920 1080 2>/dev/null || true
    fi
    sleep 2
done
