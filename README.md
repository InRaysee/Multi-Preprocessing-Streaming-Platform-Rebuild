# Multi-Preprocessing-Streaming-Platform-Rebuild

More details about features, modifications and TODOs can be found in our releases.

## Inspiration and reference

Since Dynamic Adaptive Streaming over HTTP (DASH) protocol is widely used for massive user video streaming, we build up this multi-preprocessing streaming platform to validate our throughts and ideas about how to improve users' quality of experience (QoE) when streaming via DASH.

Our early sample [Multi-Preprocessing-Streaming-Platform](https://github.com/InRaysee/Multi-Preprocessing-Streaming-Platform) was built based on [dash.js](https://github.com/Dash-Industry-Forum/dash.js). However, a self-made and light-weighted platform is more necessary for us to explore more possibilties of optimizations. Therefore, a rebuilt version, without the framework from dash.js, is published here.
   
## Modes we provide

- Multi-path mode - Start identical streams from different CDNs in parallel, and select the appropriate one to display.

## Paths we allow

20 paths of both videos and audios as maximum are allowed, which can be adjusted in options.

## Initial settings we provide

- Target buffer length (default: 4s) - the buffer level we want to keep when streaming, i.e., fetching would start when the current buffer level is smaller than this value.
- Maximal buffer length (default: 15s) - the length of buffers the player keeps, i.e., other older portion would be deleted.
- Scheduling Interval (default: 50 ms) - scheduling timeout for requesting segments periodly.

## ABR Strategies we use

Adaptive bitrate algorithms can help you select the appropriate bitrate version to stream according to your environment and requirement.

- RttThroughputRule - Switching bitrate according to real-time RTT and throughput.
- RttBufferRule - Switching bitrate according to real-time RTT and buffer level.
- HighestBitrateRule - Always switching to the highest bitrate.
- LowestBitrateRule - Always switching to the lowest bitrate.
- GlobalSwitchRule - Select path according to the location of global quality we choose.

Moreover, it is allowed to enable life-signal mode to send life signals and detect RTT of each path periodly.

## Catchup Mechanism

This can help the stream keep synchronous with the UTC time.

- Target latency (default: 3s) - the live delay we aim to approach.
- Minimal drift (default: 0.1s) - the maximal latency deviation allowed.
- Catchup playback rate (default: 0.5) - the playback rate of catchup mechanism.

Moreover, the ON-OFF switches of catchup mechanism and LL-DASH are provided.

## How to run

1. Run the HTML file via HTTP address (e.g., http://localhost:8080/Multi-Preprocessing-Streaming-Platform-Rebuild/index.html).
2. Select streaming mode, the number of video and audio paths, initial settings, ABR strategy, catchup settings in OPTIONS.
3. Set up the source URLs of each paths, both videos and the audio, or select one from preset lists.
4. Click "load" to initialize MediaPlayers according to the settings set above.
5. Use the control bar to control the players.
6. Click "Reset" to refresh the web page if necessary. Click "Reload" to reload the streams with the updated source URLs.

## Media Preprocessing

- DASH Adaptive Streaming for HTML 5 Video (Webm) : https://developer.mozilla.org/en-US/docs/Web/Media/DASH_Adaptive_Streaming_for_HTML_5_Video
- FFMPEG: http://www.ffmpeg.org/documentation.html
- FFMPEG command line builder: https://moctodemo.akamaized.net/tools/ffbuilder/
- If you want to load the media files locally, you need to set up a HTTP file server on your device: https://www.jianshu.com/p/1f53e649b932 (Chinese only)


