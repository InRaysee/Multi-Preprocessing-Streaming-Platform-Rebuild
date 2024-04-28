# Multi-Preprocessing-Streaming-Platform-Rebuild

More details about features, modifications and TODOs can be found in our releases.

## Inspiration and reference

Since Dynamic Adaptive Streaming over HTTP (DASH) protocol is widely used for massive user video streaming, we build up this multi-preprocessing streaming platform to validate our throughts and ideas about how to improve users' quality of experience (QoE) when streaming via DASH.

Our early sample [Multi-Preprocessing-Streaming-Platform](https://github.com/InRaysee/Multi-Preprocessing-Streaming-Platform) was built based on [dash.js](https://github.com/Dash-Industry-Forum/dash.js). However, a self-made and light-weighted platform is more necessary for us to explore more possibilties of optimizations. Therefore, a rebuilt version, without the framework from dash.js, is published here.
   
## Streaming modes

- Multi-path mode - Start identical streams from different CDNs in parallel, and select the appropriate one to display.
- Chat mode - Multi-path mode with local video & audio capturer (stream push not supported for now).
- Comparison mode - Multi-path mode with comparison with traditional dash.js.
- CMP mode - VR mode with a CMP-formatted stream.
- ERP mode - VR mode with a ERP-formatted stream.

## Path numbers

20 paths of both videos and audios as maximum are allowed, which can be adjusted in options.

## Initial settings

- Target buffer length (default: 4s) - the buffer level we want to keep when streaming, i.e., fetching would start when the current buffer level is smaller than this value.
- Maximal buffer length (default: 15s) - the length of buffers the player keeps, i.e., other older portion would be deleted.
- Scheduling Interval (default: 50 ms) - scheduling timeout for requesting segments periodly.

## ABR Strategies

Adaptive bitrate algorithms can help you select the appropriate bitrate version to stream according to your environment and requirement.

- RttThroughputRule - Switching bitrate according to real-time RTT and throughput.
- RttBufferRule - Switching bitrate according to real-time RTT and buffer level.
- HighestBitrateRule - Always switching to the highest bitrate.
- LowestBitrateRule - Always switching to the lowest bitrate.
- GlobalSwitchRule - Select path according to the location of global quality we choose.

Moreover, it is allowed to enable life-signal mode to send life signals and detect RTT of each path periodly.

## Catchup mechanism

This can help the stream keep synchronous with the UTC time.

- Target latency bias (default: 3s) - the live delay (compared with MPD) we aim to approach.
- Minimal drift (default: 0.1s) - the maximal latency deviation allowed.
- Catchup playback rate (default: 0.5) - the playback rate of catchup mechanism.

Moreover, the ON-OFF switches of catchup mechanism and LL-DASH are provided.

## How to run

### Steps in general

1. For VOD, check if media preprocessing is done. If not, check "Media Preprocessing Related" in the next section to learn how to generate VODs.
2. For LIVE, check if the live stream begins. If not, check the following specifical steps for different mode.
3. Run the HTML file via HTTP address (e.g., http://localhost:8080/Multi-Preprocessing-Streaming-Platform-Rebuild/index.html).
4. Select a streaming mode, the number of video and audio paths, initial settings, ABR strategy, catchup settings in OPTIONS.
5. Set up the source URLs of each paths, both videos and the audio, or select one from preset lists.
6. Click "load" to initialize MediaPlayers according to the settings set above.
7. Use the control bar to control the players.
8. Click "Reset" to refresh the web page if necessary. Click "Reload" to reload the streams with the updated source URLs and other OPTIONS.

### Specifical steps for different modes

#### Setup a live stream and upload to a server

1. Check supported streaming devices on the client side with FFMPEG commands:
   - MAC OS X
        ```
        ffmpeg -f avfoundation -list_devices true -i ""
        ```
   - Ubuntu
        ```
        ffprobe [device location]
        ```
        e.g.
        ```
        ffprobe /dev/video0
        ```
   - Windows
        ```
        ffmpeg -list_devices true -f dshow -i dummy
        ```
2. Method 1: Start stream push via RTP on the client side manually with FFMPEG commands:
   - Mac OS X
        ```
        ffmpeg -re -f avfoundation -r [framerate] -i "[video device number]:[audio device number]" -b:v [video bitrate] -preset:v ultrafast -tune:v zerolatency -f rtp rtp://[server IP]:[server port]>[SDP file name]
        ```
        e.g.
        ```
        ffmpeg -re -f avfoundation -r 30 -i "0:1" -b:v 5000k -preset:v ultrafast -tune:v zerolatency -f rtp rtp://222.20.126.108:1234>rtp_info.sdp
        ```
   - Ubuntu
        ```
        ffmpeg -re -r [framerate] -i [device location] -b:v [video bitrate] -preset:v ultrafast -tune:v zerolatency -f rtp rtp://[server IP]:[server port]>[SDP file name]
        ```
        e.g.
        ```
        ffmpeg -re -r 30 -i /dev/video0 -b:v 5000k -preset:v ultrafast -tune:v zerolatency -f rtp rtp://222.20.126.108:1234>rtp_info.sdp
        ```
   - Windows
        ```
        ffmpeg -re -rtbufsize [size] -f dshow -r [framerate] -i [media type]=[device ID] -b:v [video bitrate] -preset:v ultrafast -tune:v zerolatency -f rtp rtp://[server IP]:[server port]>[SDP file name]
        ```
        e.g.
        ```
        ffmpeg -re -rtbufsize 100M -f dshow -r 30 -i video="OBS Virtual Camera" -b:v 5000k -preset:v ultrafast -tune:v zerolatency -f rtp rtp://222.20.126.108:1234>rtp_info.sdp
        ```
   Note that it is essential to copy the SDP file to the path where runs FFMPEG transcoder in the server.
3. Method 2: Start stream push via RTSP on the client side manually with FFMPEG commands:
   - Mac OS X
        ```
        ffmpeg -re -f avfoundation -r [framerate] -i "[video device number]:[audio device number]" -b:v [video bitrate] -preset:v ultrafast -tune:v zerolatency -f rtsp -rtsp_transport tcp rtsp://[server IP]:[server port]/[stream ID]
        ```
        e.g.
        ```
        ffmpeg -re -f avfoundation -r 30 -i "0:1" -b:v 5000k -preset:v ultrafast -tune:v zerolatency -f rtsp -rtsp_transport tcp rtsp://222.20.126.108:8554/mystream
        ```
   - Ubuntu
        ```
        ffmpeg -re -r [framerate] -i [device location] -b:v [video bitrate] -preset:v ultrafast -tune:v zerolatency -f rtsp -rtsp_transport tcp rtsp://[server IP]:[server port]/[stream ID]
        ```
        e.g.
        ```
        ffmpeg -re -r 30 -i /dev/video0 -b:v 5000k -preset:v ultrafast -tune:v zerolatency -f rtsp -rtsp_transport tcp rtsp://222.20.126.108:8554/mystream
        ```
   - Windows
        ```
        ffmpeg -re -rtbufsize [size] -f dshow -r [framerate] -i video=[video device ID] -re -rtbufsize [size] -f dshow -i audio=[audio device ID] -b:v [video bitrate] -c:v libx264 -b:a 96k -c:a aac -preset:v ultrafast -tune:v zerolatency -f rtsp -rtsp_transport tcp rtsp://[server IP]:[server port]/[stream ID]
        ```
        e.g.
        ```
        ffmpeg -re -rtbufsize 300M -f dshow -r 30 -i video="OBS Virtual Camera" -re -rtbufsize 300M -f dshow -i audio="麦克风 (Logitech BRIO)" -b:v 5000k -c:v libx264 -b:a 96k -c:a aac -preset:v ultrafast -tune:v zerolatency -f rtsp -rtsp_transport tcp rtsp://222.20.126.108:8554/mystream
        ```
   Note that the server should be running a Docker container for RTSP (detailed in the following subsection).

#### Run a server for real-time processing

1. (FOR RTP) Run FFMPEG transcoder for RTP in the server:
   - Ubuntu .sh file for converting the stream into two bitrate versions without audio, e.g.
        ```
        #!/bin/bash
        time=$(time)
        localtime = ${localtime}
        /usr/local/ffmpeg/bin/ffmpeg -protocol_whitelist "file,udp,rtp" -i rtp_info.sdp \
            -filter_complex "split=2[s0][s1];\
            [s0]scale=1920x1080[s0];\
            [s0]drawtext=fontfile=/usr/share/fonts/truetype/freefont/FreeSans.ttf:fontsize=96:x=0:y=0:fontcolor=black:box=1:text='1080p,%{localtime}'[s0];\
            [s1]scale=160x90[s1];\
            [s1]drawtext=fontfile=/usr/share/fonts/truetype/freefont/FreeSans.ttf:fontsize=8:x=0:y=0:fontcolor=black:box=1:text='90p,%{localtime}'[s1]" \
            -c:v libx264 -force_key_frames "expr:gte(t,n_forced*2)" \
            -preset:v ultrafast -tune:v zerolatency \
            -map [s0] -map [s1] \
            -ldash 1 -streaming 1 -use_template 1 -use_timeline 0 \
            -adaptation_sets "id=0,streams=v" \
            -seg_duration 2 -frag_duration 0.2 -frag_type duration \
            -utc_timing_url "https://time.akamai.com/?iso" \
            -window_size 15 -extra_window_size 15 -remove_at_exit 1 \
            -f dash /usr/local/nginx/html/dash/stream.mpd
        ```
2. (FOR RTSP - STEP 1) Run a Docker container for RTSP in the server:
   - Ubuntu with Docker, e.g.
        ```
        docker run -itd -e MTX_PROTOCOLS=tcp -p 8554:8554 -p 8888:8888 -p 8889:8889 -p 8890:8890/udp --name rtsp-server bluenviron/mediamtx
        ```
3. (FOR RTSP - STEP 2) Run a FFMPEG transcoder for RTSP in the server:
   - Ubuntu .sh file for converting the stream into single bitrate version with audio, e.g.
        ```
        #!/bin/bash
        time=$(time)
        localtime = ${localtime}
        /usr/local/ffmpeg/bin/ffmpeg -rtsp_transport tcp -i rtsp://222.20.126.108:8554/mystream \
             -vf "drawtext=text='1080p,%{localtime}':x=0:y=100:fontsize=96:fontfile=/usr/share/fonts/truetype/freefont/FreeSans.ttf" \
             -s 1920x1080  -c:v libx264 -force_key_frames "expr:gte(t,n_forced*2)" \
             -preset:v ultrafast -tune:v zerolatency \
             -c:a aac -ar 48000 -b:a 96k \
             -map 0:v:0 \
             -map 0:a:0 \
             -ldash 1 -streaming 1 -use_template 1 -use_timeline 0 \
             -adaptation_sets "id=0,streams=v id=1,streams=a" \
             -seg_duration 2 -frag_duration 0.2 -frag_type duration \
             -utc_timing_url "https://time.akamai.com/?iso" \
             -window_size 15 -extra_window_size 15 -remove_at_exit 1 \
             -f dash /usr/local/nginx/html/dash/rtsp/stream.mpd
        ```

## Media Preprocessing Related

- Ultra-Low-Latency Multi-Bitrate Mobile Video Streaming Platform: https://github.com/InRaysee/ULL-Multi-Bitrate-Mobile-Video-Streaming-Platform
- DASH Adaptive Streaming for HTML 5 Video (Webm): https://developer.mozilla.org/en-US/docs/Web/Media/DASH_Adaptive_Streaming_for_HTML_5_Video
- FFMPEG: http://www.ffmpeg.org/documentation.html
- FFMPEG command line builder: https://moctodemo.akamaized.net/tools/ffbuilder/
- If you want to load the media files locally, you need to set up a HTTP file server on your device: https://www.jianshu.com/p/1f53e649b932 (Chinese only)

