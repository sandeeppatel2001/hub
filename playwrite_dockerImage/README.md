## set up for running in direct ubuntu machine

## Install Packages
```
sudo apt update
sudo apt install -y chromium-browser wget gnupg unzip xvfb fluxbox x11vnc
```

## 2 Start virtual display (Xvfb)
```
Xvfb :99 -screen 0 1920x1080x16 &
export DISPLAY=:99
```

## 3 Start VNC server (to view Chromium UI)
```
x11vnc -display :99 -rfbport 5900 -nopw -forever &
```

## 4️ Start Chromium with Remote Debugging Port (this is CRITICAL)
```
DISPLAY=:99 chromium-browser \
  --remote-debugging-port=9222 \
  --no-sandbox \
  --disable-gpu \
  --disable-dev-shm-usage &
```

## 5 (Optional) Start NoVNC so you can view Chromium in browser
```
git clone https://github.com/novnc/noVNC
cd noVNC
./utils/novnc_proxy --vnc localhost:5900 --listen 8080
```


## now build docker image of all this.

```
docker build -t browser-sandbox .
```

## RUn image
```
docker run -p 8080:8080 -p 9222:9222 browser-sandbox
```