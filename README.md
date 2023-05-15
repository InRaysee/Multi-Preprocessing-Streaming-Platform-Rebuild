# Multi-Preprocessing-Streaming-Platform

More details about features, modifications and TODOs can be found in our releases.

## Tools and Frameworks we use

- dash.js v4.3.0 - For adaptive bitrate streaming via DASH.
   Noted that we've made some modifications on dash.js source codes, more details can be found in [changelog.txt](https://github.com/InRaysee/Multi-Preprocessing-Streaming-Platform/blob/main/dash.js/changelog.txt). If any change further necessary please modify in [src](https://github.com/InRaysee/Multi-Preprocessing-Streaming-Platform/blob/main/dash.js/src) then copy all source codes to dash.js original path and recompile with `npm` commands. Once dist files are generated, please replace [the old dist files](https://github.com/InRaysee/Multi-Preprocessing-Streaming-Platform/blob/main/dash.js/dist) here with the new ones.
   
## Modes we provide

- Multi-path mode - Start not more than 6 identical streams from different CDNs in parallel, and select the appropriate one to display.
- VR mode - Start a panorama video in the CMP format (a cube with 6 faces).

## ABR Strategies we use

Adaptive bitrate algorithms can help you select the appropriate bitrate version to stream according to your environment and requirement.

- DefaultRule - Using default ABR rules by dash.js (observing each path's stats independently). 
- MyThroughputRule - Switching bitrate according to real-time throughput.
- MultiPathRule - Appropriate bitrate for the highest throughput, otherwise the lowest bitrate.
   - Keep highest with same MPD.
   - Buffer-based with same MPD.
- HighestBitrateRule - Always switching to the highest bitrate.
- LowestBitrateRule - Always switching to the lowest bitrate.
- GlobalSwitchRule - Select path according to the location of global quality we choose.
- FOVRule - selects the possible bitrate according to FOV (Only for VR mode).

## Path Switching Strategies we use

This can help you select an appropriate path to get the stream.

- Manual Switch: Select the path you want manually.
- Downloading Quality based: Choose the path with the highest downloading quality.
- Playback Quality based: Choose the path with the highest playback quality.
- Buffer & Sync & Quality: Choose the paths with non-empty buffers, and rule out the paths not in synchronization, then select the path with the highest playback quality.

## Catchup Mechanism available

This can help all streams keep synchronous and real-time in both VOD and live mode.

- Scheduling Timeout: 500 as default, scheduling timeout for requesting segments.
- Target latency: 3 as default, the live delay allowed.
- Max drift: 3 as default, the maximal latency deviation allowed.
- Min drift: 0.02 as default, the minimal latency deviation allowed.
- Catchup playback rate: 0.5 as default, catchup playback rate.
- Live catchup latency threshold: 60 as default, maximal latency allowed to catch up.

## How to run

#### Player over DASH

1. Run the HTML file via HTTP address (e.g., http://localhost:8080/Multi-Preprocessing-Streaming-Platform/index.html).
2. Select streaming mode, the number of video and audio paths, ABR strategy, catchup settings and path switching strategy in OPTIONS.
3. Set up the source URLs of each paths, both videos and the audio, or select one from preset lists.
4. Click "load" to initialize MediaPlayers according to the settings set above.
5. Use the control bar to control the players.
6. Options are not recommanded to change after initialization. Click "Reset" to refresh the web page if necessary. Click "Reload" to reload the streams with the updated source URLs.

## Media Preprocessing

- DASH Adaptive Streaming for HTML 5 Video (Webm) : https://developer.mozilla.org/en-US/docs/Web/Media/DASH_Adaptive_Streaming_for_HTML_5_Video
- FFMPEG: http://www.ffmpeg.org/documentation.html
- If you want to load the media files locally, you need to set up a HTTP file server on your device: https://www.jianshu.com/p/1f53e649b932 (Chinese only)

## Procedures in DASH

![Procedures in DASH](https://user-images.githubusercontent.com/42538108/187603592-4633aa55-14cf-46d3-bcea-bdbecd83cdb1.png)


