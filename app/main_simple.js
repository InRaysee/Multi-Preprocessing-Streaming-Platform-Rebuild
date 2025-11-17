//////////////////////////////// InRaysee DASH Player ///////////////////////////////
/*
TODOs:
  [x] 1. Life signals.
  [-] 2. ABR rules.
    [-] 2.1. RttThroughputRule.
    [-] 2.2. RttBufferRule.
    [x] 2.3. HighestBitrateRule.
    [x] 2.4. LowestBitrateRule.
    [x] 2.5. GlobalSwitchRule.
  [x] 3. Path switching.
  [x] 4. Reload.
  [ ] 5. Forced switch quality.
  [x] 6. Multiple stream URLs.
  [-] 7. Data monitors, charts and stats.
  [ ] 8. Module spliting.
  [x] 9. Multiple periods and different segment indexs.
  [ ] 10. Live mode with catchup.
  [ ] 11. VR mode.
*/
/////////////////////////////////////////////////////////////////////////////////////

var app = angular.module('DashPlayer', ['DashSourcesService', 'angular-flot']);

// Fetch sources.json
angular.module('DashSourcesService', ['ngResource']).factory('sources', function ($resource) {
    return $resource('app/sources.json', {}, {
        query: {
            method: 'GET',
            isArray: true
        }
    });
});

app.controller('DashController', ['$scope', '$interval', 'sources', function ($scope, $interval, sources) {

    $interval(function () {}, 1);

    // Load the list of available streams
    sources.query(function (data) {
        $scope.availableStreams = data;
    });

/////////////////////////////////////////////////////////////////////////////////////
/*             Global variables (containers: cannot adjust mannually)              */
/////////////////////////////////////////////////////////////////////////////////////

    $scope.intervalFunctions = [];  // Container for all interval functions (except life signal fetcher)
    $scope.intervalLifeSignalFunctions = {  // Container for life signal interval functions
        video: [],
        audio: []
    };

    $scope.mediaSource = null;  // Container for the MediaSource object
    $scope.streamElement = null;  // Container for video element in HTML page
    $scope.controllBar = null;  // Container for video control bar
    $scope.streamSourceBuffer = {  // Containers for SourceBuffers
        video: null,
        audio: null
    };
    $scope.abortController = {  // Containers for abort controllers of fetch requests
        video: null,
        audio: null
    };
    $scope.streamBufferToAppend = {  // Queues of buffers to append
        video: [],
        audio: []
    };
    $scope.initCache = {  // Caches of init segments loaded
        video: [],
        audio: []
    };
    $scope.streamMpds = {  // Arrays of MPDs
        video: [],
        audio: []
    };
    $scope.streamBitrateList = {  // Arrays of bitrate lists
        video: [],
        audio: []
    };
    $scope.streamInfo = {  // Information of streams selected
        video: null,
        audio: null
    };
    $scope.streamSourceBufferMimeCodecs = {  // Containers for SourceBuffers' mimeCodecs
        video: NaN,
        audio: NaN
    };

    $scope.streamURLsForLifeSignals = {  // Save the stream URLs for life signals
        video: [],
        audio: []
    };

    $scope.sourceOpenNum = 0;  // Flags for sourceOpen events
    $scope.streamDuration = NaN;  // Total duration of the VOD stream
    $scope.streamStartTime = NaN;  // Availability start time of the live stream
    $scope.streamStartTimeFormatted = null;  // Availability start time of the live stream
    $scope.streamTimeShiftDepth = NaN;  // The valid time of segments
    $scope.streamIsDynamic = NaN;  // Live mode when true, otherwise VOD mode
    $scope.autoSwitchTrack = {  // Flags for judging if the tracks are auto switched
        video: NaN,
        audio: NaN
    };
    $scope.autoSwitchBitrate = {  // Flags for judging if the bitrates are auto switched
        video: NaN,
        audio: NaN
    };
    $scope.isFetchingSegment = {  // Flags for identifying if fetching the segment
        video: NaN,
        audio: NaN
    };
    $scope.isSeeking = NaN;  // Flag for identifying if seeking the segment
    $scope.utcTime = null;  // UTC time
    $scope.utcTimeFormatted = null;  // UTC time
    $scope.startupTime = null;  // Startup time of streaming
    $scope.startupTimeFormatted = null;  // Startup time of streaming
    $scope.baselineTime = null;  // Baseline time of live stream
    $scope.availabilityTimeOffset = NaN;  // availability time offset from MPD
    $scope.isStartup = NaN;  // Flag for identifying if the player starts up

    $scope.stallTime = 0;  // Record the length of total stall time
    $scope.stallFlag = NaN;  // Flag for stall

    $scope.forcedPause = false;  // Pause forcedly

    $scope.lon = 0;  // Longitude for VR mode
    $scope.lat = 0;  // Latitude for VR mode

    $scope.monitorRtt = {  // Monitor data: RTT
        video: [],
        audio: []
    };
    $scope.monitorRttForLifeSignal = {  // Monitor data: RTT (For life signal fetchers)
        video: [],
        audio: []
    };

    // $scope.clientServerTimeShift = 0;  // Time shift between client and server from TimelineConverter
    // $scope.normalizedTime = NaN;  // Set the fastest mediaplayer's timeline as the normalized time
    // $scope.totalThroughput = NaN;  // Compute the total throughput considering all players


/////////////////////////////////////////////////////////////////////////////////////
/*                Global variables (private: only adjust in codes)                 */
/////////////////////////////////////////////////////////////////////////////////////

    $scope.CONTENT_TYPE = ["video", "audio"];
    $scope.DYNAMIC = "dynamic";
    $scope.STATIC = "static";
    $scope.VIDEO_NUMBER_OF_CMP_MODE = 6;
    $scope.AUDIO_NUMBER_OF_CMP_MODE = 1;
    $scope.INTERVAL_OF_PLATFORM_ADJUSTMENT = 10;
    $scope.INTERVAL_OF_UPDATE_CHARTS = 500;
    $scope.INTERVAL_OF_APPEND_BUFFER = 10;
    $scope.INTERVAL_OF_REMOVE_BUFFER = 1000;
    $scope.INTERVAL_OF_LIFE_SIGNAL_FETCHER = 1000;
    $scope.INTERVAL_OF_SET_PLAYBACK_RATE = 100;
    $scope.INTERVAL_OF_SET_TARGET_LATENCY_BIAS = 1000;
    $scope.TIMEOUT_OF_SOURCE_OPEN = 1;
    $scope.TIMEOUT_OF_ADD_SOURCEBUFFER = 1;
    $scope.TIMEOUT_OF_RELOAD_STREAM = 1000;
    $scope.TIMEOUT_OF_FETCH_LOADER = 1000;
    $scope.AVERAGE_THROUGHPUT_WINDOW = 5;
    $scope.LEGEND_COLUMN_LENGTH = 10;
    $scope.REQUEST_LIST_LENGTH = 20;
    $scope.TYPE_OF_MPD = "MPD";
    $scope.TYPE_OF_INIT_SEGMENT = "InitSegment";
    $scope.TYPE_OF_MEDIA_SEGMENT = "MediaSegment";
    $scope.TYPE_OF_LIFE_SIGNAL = "LifeSignal";
    $scope.EVENT_TIME_UPDATE = "timeupdate";
    $scope.PLAYING = "playing";
    $scope.PAUSE = "pause";
    $scope.WAITING = "waiting";
    $scope.EVENT_UPDATE_END = "updateend";
    $scope.TAG_OF_REPRESENTATION_ID = "$RepresentationID$";
    $scope.TAG_OF_SEGMENT_INDEX = "$Number$";
    $scope.RESPONSE_TYPE_OF_MPD = "text";
    $scope.RESPONSE_TYPE_OF_SEGMENT = "arraybuffer";
    $scope.RESPONSE_TYPE_OF_LIFE_SIGNAL = "text";
    $scope.HTTP_REQUEST_METHOD = "get";
    $scope.DOM_NODE_TYPES = {  // Node types for parsers
        ELEMENT_NODE 	   : 1,
        TEXT_NODE    	   : 3,
        CDATA_SECTION_NODE : 4,
        COMMENT_NODE	   : 8,
        DOCUMENT_NODE 	   : 9
    };

    $scope.matchers = [  // Matchers for data adjustments (dash.js)
        new DurationMatcher(),
        new DateTimeMatcher(),
        new NumericMatcher(),
        new StringMatcher()
    ];
    
    $scope.abrRules = {  // ABR rules preloaded
        highestBitrateRule: new HighestBitrateRuleClass(),
    };

    // $scope.IntervalOfSetNormalizedTime = 10;  // [For setting interval] Set the fastest mediaplayer's timeline as the normalized time


/////////////////////////////////////////////////////////////////////////////////////
/*                   Global variables (public: adjust by users)                    */
/////////////////////////////////////////////////////////////////////////////////////

    $scope.optionButton = "Show Options";  // Save the state of option button
    $scope.urlButton = "Hide URLs";  // Save the state of URL button

    $scope.mode = 'ERP';  // Save the selected mode

    $scope.streamURLs = {  // Save the selected media sources
        "video": [
            "https://222.20.126.228:7011/dash/rtsp/stream.mpd",
            "https://222.20.126.228:7012/dash/rtsp/stream.mpd",
            "https://222.20.126.228:7013/dash/rtsp/stream.mpd",
            "https://222.20.126.228:7014/dash/rtsp/stream.mpd",
            "https://222.20.126.228:7015/dash/rtsp/stream.mpd",
            "https://222.20.126.228:7016/dash/rtsp/stream.mpd"
        ],
        "audio": [
            "https://222.20.126.228:7011/dash/rtsp/stream.mpd"
        ]
    };

    $scope.streamNum = {  // Number of paths for fetching streams
        video: $scope.streamURLs.video.length,
        audio: $scope.streamURLs.audio.length
    }

    $scope.targetBuffer = 4;  // The buffer level desired to be fetched
    $scope.maximalBuffer = 15;  // The buffer level desired to be saved
    $scope.INTERVAL_OF_SCHEDULE_FETCHER = 50;

    $scope.selectedRule = "highestBitrateRule";  // Save the selected ABR strategy
    $scope.lifeSignalEnabled = true;  // Whether send life signals or not

    $scope.targetLatencyBias = 0;  // The live delay allowed
    $scope.catchupPlaybackRate = 0.5;  // Catchup playback rate
    $scope.minDrift = 0.1;  // The minimal latency deviation allowed
    // $scope.maxDrift = 3;  // The maximal latency deviation allowed
    // $scope.liveCatchupLatencyThreshold = 60;  // Maximal latency allowed to catch up
    $scope.catchupEnabled = true;  // Whether catch up when playback or not
    $scope.llDashEnabled = true;  // Whether enable low-latency DASH or not
    $scope.autoAdjustingLatencyBias = false;  // Whether auto adjusting latency bias or not


/////////////////////////////////////////////////////////////////////////////////////
/*                            Functions: UI and options                            */
/////////////////////////////////////////////////////////////////////////////////////

    // Showing/hiding options
    $scope.showurl = function () {

        if($scope.urlButton == "Show URLs"){
            document.getElementById('videoSource').style = "";
            document.getElementById('audioSource').style = "";
            $scope.urlButton = "Hide URLs";
        }else{
            document.getElementById('videoSource').style = "display: none;";
            document.getElementById('audioSource').style = "display: none;";
            $scope.urlButton = "Show URLs";
        }

    };


/////////////////////////////////////////////////////////////////////////////////////
/*                            Functions: media players                             */
/////////////////////////////////////////////////////////////////////////////////////

    // Loading streams
    $scope.loadStream = function() {

        document.getElementById("load").style.display = "none";
        document.getElementById("reload").style.display = "inline-block";
        $scope.aframeInit();

    };

    // Initializing the aframe page
    $scope.aframeInit = function() {

        document.getElementById('vr').src = "./erp.html";
        $scope.lon = 0;
        $scope.lat = 0;

    };

    // Enabling the FOV event listener in iframe, and start initialization
    document.getElementById('vr').onload = function () {

        setTimeout(() => {
            $scope.videoInit();
        }, 3000);

    };

    // Reloading streams
    $scope.reloadStream = function() {

        document.getElementById("reload").disabled = true;

        $scope.streamElement.pause();

        for (let i = 0; i < $scope.CONTENT_TYPE.length; i++) {
            if ($scope.abortController[$scope.CONTENT_TYPE[i]]) {
                $scope.abortController[$scope.CONTENT_TYPE[i]].abort();
            }
        }

        for (let i = 0; i < $scope.intervalFunctions.length; i++) {
            clearInterval($scope.intervalFunctions[i]);
        }
        $scope.intervalFunctions = [];
        for (let i = 0; i < $scope.CONTENT_TYPE.length; i++) {
            for (let j = 0; j < $scope.intervalLifeSignalFunctions[$scope.CONTENT_TYPE[i]].length; j++) {
                if ($scope.intervalLifeSignalFunctions[$scope.CONTENT_TYPE[i]][j]) {
                    clearInterval($scope.intervalLifeSignalFunctions[$scope.CONTENT_TYPE[i]][j]);
                }
            }
            $scope.intervalLifeSignalFunctions[$scope.CONTENT_TYPE[i]] = [];
        }

        for (let i = 0; i < $scope.CONTENT_TYPE.length; i++) {
            if ($scope.streamSourceBuffer[$scope.CONTENT_TYPE[i]]) {
                $scope.streamSourceBuffer[$scope.CONTENT_TYPE[i]].removeEventListener($scope.EVENT_UPDATE_END, $scope.appendBuffer);
                $scope.streamSourceBuffer[$scope.CONTENT_TYPE[i]].removeEventListener($scope.EVENT_UPDATE_END, $scope.removeBuffer);
                $scope.streamSourceBuffer[$scope.CONTENT_TYPE[i]].removeEventListener($scope.EVENT_UPDATE_END, $scope.onBufferLevelUpdated);
            }
        }

        if ($scope.controllBar) {
            $scope.streamElement.removeEventListener($scope.EVENT_TIME_UPDATE, $scope.controllBar.onPlaybackTimeUpdate);
        }
        if ($scope.mediaSource) {
            $scope.mediaSource.removeEventListener('sourceopen', $scope.sourceOpen);
        }

        setTimeout(() => {

            $scope.streamBufferToAppend = {
                video: [],
                audio: []
            };
            $scope.initCache = {
                video: [],
                audio: []
            };
            $scope.streamMpds = {
                video: [],
                audio: []
            };
            $scope.streamBitrateList = {
                video: [],
                audio: []
            };
            $scope.streamInfo = {
                video: null,
                audio: null
            };
            $scope.streamSourceBufferMimeCodecs = {
                video: NaN,
                audio: NaN
            };
    
            $scope.streamURLsForLifeSignals = {
                video: [],
                audio: []
            };
    
            $scope.sourceOpenNum = 0;
            $scope.streamDuration = NaN;
            $scope.streamStartTime = NaN;
            $scope.streamStartTimeFormatted = null;
            $scope.streamTimeShiftDepth = NaN;
            $scope.streamIsDynamic = NaN;
            $scope.autoSwitchTrack = {
                video: NaN,
                audio: NaN
            };
            $scope.autoSwitchBitrate = {
                video: NaN,
                audio: NaN
            };
            $scope.isFetchingSegment = {
                video: NaN,
                audio: NaN
            };
            $scope.isSeeking = NaN;
            $scope.utcTime = null;
            $scope.utcTimeFormatted = null;
            $scope.startupTime = null;
            $scope.startupTimeFormatted = null;
            $scope.baselineTime = null;
            $scope.availabilityTimeOffset = NaN;
            $scope.isStartup = NaN;

            $scope.stallTime = 0;
            $scope.stallFlag = NaN;

            $scope.forcedPause = false;

            $scope.lon = 0;
            $scope.lat = 0;

            $scope.monitorRtt = {
                video: [],
                audio: []
            };
            $scope.monitorRttForLifeSignal = {
                video: [],
                audio: []
            };

            for (let i = 0; i < $scope.CONTENT_TYPE.length; i++) {
                if ($scope.streamSourceBuffer[$scope.CONTENT_TYPE[i]]) {
                    $scope.streamSourceBuffer[$scope.CONTENT_TYPE[i]].remove(0, $scope.mediaSource.duration);
                    $scope.mediaSource.removeSourceBuffer($scope.streamSourceBuffer[$scope.CONTENT_TYPE[i]]);
                }
            }
            $scope.streamSourceBuffer = {
                video: null,
                audio: null
            };    
            if ($scope.controllBar) {
                $scope.controllBar.destroy();
                $scope.controllBar = null;
            }
    
            if ($scope.streamElement) {
                $scope.streamElement.src = "";
            }
            if ($scope.streamElement) {
                $scope.streamElement.src = "";
                $scope.streamElement = null;
            }
            if ($scope.mediaSource) {
                delete $scope.mediaSource;
            }
            
            $scope.loadStream();

            document.getElementById("reload").removeAttribute("disabled");

        }, $scope.TIMEOUT_OF_RELOAD_STREAM);

    };

    // Loading streams
    $scope.videoInit = function() {

        // Check if MediaSource is supported in window
        const supportMediaSource = 'MediaSource' in window;
        if (!supportMediaSource) {
            window.alert("MediaSource is not supported in window!");
            return;
        }

        // Check if paths of videos/audios are non-null
        if (!$scope.checkPaths()) {
            return;
        }

        // Copy stream URLs for life signals
        for (let i = 0; i < $scope.streamURLs.video.length; i++) {
            $scope.streamURLsForLifeSignals.video[i] = $scope.streamURLs.video[i];
        }
        for (let i = 0; i < $scope.streamURLs.audio.length; i++) {
            $scope.streamURLsForLifeSignals.audio[i] = $scope.streamURLs.audio[i];
        }

        // Attach view & source
        if (!$scope.mediaSource) {
            $scope.mediaSource = new MediaSource();
        }
        if (!$scope.mediaSource) {
            window.alert("There is no MediaSource object generated!");
            return;
        }
        if (!$scope.streamElement) {
            $scope.streamElement = $scope.mode == "ERP" ? document.getElementById('vr').contentWindow.document.getElementById('video') : document.getElementById('video');
            $scope.streamElement.src = URL.createObjectURL($scope.mediaSource);
        }
        if (!$scope.streamElement) {
            window.alert("There is no video element in window!");
            return;
        }

        // Load MPDs
        $scope.mediaSource.addEventListener('sourceopen', $scope.sourceOpen());

    };

    // Triggered when mediaSoure is ready to open sources
    $scope.sourceOpen = function(contentType, pathIndex) {

        setTimeout(() => {
            
            // Fetch and load MPDs
            for (let i = 0; i < $scope.CONTENT_TYPE.length; i++) {
                for (let j = 0; j < $scope.streamNum[$scope.CONTENT_TYPE[i]]; j++) {
                    $scope.fetchMpd($scope.CONTENT_TYPE[i], $scope.streamURLs[$scope.CONTENT_TYPE[i]][j], (response, requestInfo) => {
                        $scope.monitorRtt[$scope.CONTENT_TYPE[i]][j] = (requestInfo.tresponse - requestInfo.trequest).toFixed(0);
                        $scope.loadMpd(response, $scope.CONTENT_TYPE[i], j);
                    });
                }
            }

            // Add event listeners:  update playback time  ////////////////////////////
            $scope.streamElement.addEventListener($scope.EVENT_TIME_UPDATE, $scope.onPlaybackTimeUpdate);
            $scope.streamElement.addEventListener($scope.PLAYING, $scope.onSetPauseBtn);
            $scope.streamElement.addEventListener($scope.PAUSE, $scope.onSetPlayBtn);
            $scope.streamElement.addEventListener($scope.WAITING, $scope.onSetPlayBtn);

            // Add interval function: append buffers in intervals
            $scope.intervalFunctions.push(setInterval($scope.appendBuffer, $scope.INTERVAL_OF_APPEND_BUFFER));
            $scope.intervalFunctions.push(setInterval($scope.removeBuffer, $scope.INTERVAL_OF_REMOVE_BUFFER));

            // Add interval function: update charts
            $scope.intervalFunctions.push(setInterval($scope.updateCharts, $scope.INTERVAL_OF_UPDATE_CHARTS));

            // Add interval function: set playback rate
            $scope.intervalFunctions.push(setInterval($scope.setPlaybackRate, $scope.INTERVAL_OF_SET_PLAYBACK_RATE));

            // Add interval function: set target latency bias
            $scope.intervalFunctions.push(setInterval($scope.setTargetLatencyBias, $scope.INTERVAL_OF_SET_TARGET_LATENCY_BIAS));

        }, $scope.TIMEOUT_OF_SOURCE_OPEN);

    };

    // Fetch MPDs by a request
    $scope.fetchMpd = function(contentType, url, callback) {

        if (url == "") {
            window.alert("Empty URL when fetching MPD!");
            return;
        }
        $scope.xmlLoader(contentType, $scope.resolveUrl($scope.TYPE_OF_MPD, url), $scope.RESPONSE_TYPE_OF_MPD, callback);

    };

    // Load MPDs from responses and initialize
    $scope.loadMpd = function(response, contentType, i) {

        var parser = new DOMParser();
        var xmlData = parser.parseFromString(response, "text/xml");
        var manifest = $scope.parseManifest(xmlData);
        
        if (!manifest.MPD) {
            window.alert("Wrong manifest of " + contentType + "URLs[" + i + "]: No children node MPD in the manifest!");
            return;
        }
        manifest = manifest.MPD;

        var baseUrl = manifest.BaseURL ? manifest.BaseURL[0].undefined[0] : $scope.resolveUrl($scope.TYPE_OF_MPD, $scope.streamURLs[contentType][i]);
        if (baseUrl == "./") {
            baseUrl = $scope.streamURLs[contentType][i].slice(0, $scope.streamURLs[contentType][i].lastIndexOf("/") + 1);
        }
        manifest.baseUrl = baseUrl ? baseUrl.slice(0, baseUrl.lastIndexOf("/") + 1) : NaN;
        if (!manifest.baseUrl || manifest.baseUrl == "") {
            window.alert("Wrong manifest of " + contentType + "URLs[" + i + "]: No base URL available in the manifest!");
            return;
        }

        $scope.streamMpds[contentType][i] = manifest;
        console.log("StreamMpds." + contentType + "[" + i + "] is loaded!");
        $scope.register($scope.streamMpds[contentType][i], contentType, i);

    };

    // Executed when MPDs are loaded
    $scope.register = function(manifest, contentType, pathIndex) {

        try {
            // Check if the type is the same
            if (!manifest.type || ($scope.streamIsDynamic && (manifest.type == $scope.DYNAMIC) != $scope.streamIsDynamic)) {
                throw "Different type of manifest!";
            }
            
            // Check if the duration is equal
            if ((manifest.type == $scope.STATIC && (!manifest.mediaPresentationDuration || ($scope.streamDuration && manifest.mediaPresentationDuration != $scope.streamDuration)))
                || (manifest.type == $scope.DYNAMIC && (!manifest.availabilityStartTime || ($scope.streamStartTime && manifest.availabilityStartTime.getTime() != $scope.streamStartTime.getTime())))
            ) {
                throw "Unequal duration or start time!";
            }

            // Register bitrate lists
            let registerBitrateListResult = $scope.registerBitrateList(manifest, contentType, pathIndex);
            if (registerBitrateListResult != "SUCCESS") {
                throw registerBitrateListResult;
            }

            
            // Register stream information and create SourceBuffer
            if (!$scope.streamSourceBuffer[contentType]) {
                // Register stream information
                let registerStreamInfoResult = $scope.registerFirstStreamInfo(manifest, contentType, pathIndex);
                if (registerStreamInfoResult == "SUCCESS") {
                    // Fetch the first init segment and the first media segment
                    $scope.fetchSegment(contentType, $scope.TYPE_OF_INIT_SEGMENT);
                    $scope.intervalFunctions.push(setInterval($scope.scheduleFetcher.bind(this, contentType), $scope.INTERVAL_OF_SCHEDULE_FETCHER));
                } else if (registerStreamInfoResult != "ABORT") {
                    throw registerStreamInfoResult;
                }
            }

            // Create and initialize control bar
            if (!$scope.controllBar) {
                $scope.controllBar = new ControlBar();
                $scope.controllBar.initialize();
                $scope.controllBar.destroyAllMenus();
            }
            // Create and add track/bitrate/caption lists into control bar
            $scope.controllBar.onStreamActivated(contentType, pathIndex);

            // Life signals
            $scope.monitorRttForLifeSignal[contentType][pathIndex] = $scope.monitorRtt[contentType][pathIndex];
            $scope.intervalLifeSignalFunctions[contentType][pathIndex] = setInterval($scope.lifeSignalFetcher.bind(this, contentType, pathIndex), $scope.INTERVAL_OF_LIFE_SIGNAL_FETCHER);
        } catch (e) {
            window.alert("Error when registerring " + contentType + " " + pathIndex + (e == "" ? e : ": " + e));
        }
    
    };

    // Register bitrate lists
    $scope.registerBitrateList = function(manifest, contentType, i) {
        
        try {
            $scope.streamBitrateList[contentType][i] = [];
            $scope.initCache[contentType][i] = [];
            if (!manifest.Period || manifest.Period.length == 0) {
                throw "No period is available in path " + i + "!";
            }
            for (let j = 0; j < manifest.Period.length; j++) {
                $scope.streamBitrateList[contentType][i][j] = [];
                $scope.initCache[contentType][i][j] = [];
                if (!manifest.Period[j].AdaptationSet || manifest.Period[j].AdaptationSet.length == 0) {
                    throw "No adaptation set is available in path " + i + ", period " + j + "!";
                }
                for (let jj = 0; jj < manifest.Period[j].AdaptationSet.length; jj++) {
                    if (manifest.Period[j].AdaptationSet[jj].contentType == contentType
                            || (manifest.Period[j].AdaptationSet[jj].Representation != undefined && manifest.Period[j].AdaptationSet[jj].Representation[0].mimeType != undefined && manifest.Period[j].AdaptationSet[jj].Representation[0].mimeType.slice(0, 5) == contentType)) {
                        $scope.streamBitrateList[contentType][i][j][jj] = [];
                        $scope.initCache[contentType][i][j][jj] = [];
                        if (!manifest.Period[j].AdaptationSet[jj].Representation || manifest.Period[j].AdaptationSet[jj].Representation.length == 0) {
                            throw "No representation is available in path " + i + ", period " + j + ", adaptation set " + jj + "!";
                        }
                        for (let jjj = 0; jjj < manifest.Period[j].AdaptationSet[jj].Representation.length; jjj++) {
                            let mimeFromMpd = manifest.Period[j].AdaptationSet[jj].mimeType || manifest.Period[j].AdaptationSet[jj].Representation[jjj].mimeType;
                            let codecsFromMpd = manifest.Period[j].AdaptationSet[jj].codecs || manifest.Period[j].AdaptationSet[jj].Representation[jjj].codecs;
                            if (mimeFromMpd && codecsFromMpd) {
                                let mimeCodecsFromMpd = mimeFromMpd + ";codecs=\"" + codecsFromMpd + "\"";
                                if ('MediaSource' in window && MediaSource.isTypeSupported(mimeCodecsFromMpd)) {
                                    $scope.streamBitrateList[contentType][i][j][jj][jjj] = {
                                        // From Representration
                                        id: manifest.Period[j].AdaptationSet[jj].Representation[jjj].id != undefined ?
                                            manifest.Period[j].AdaptationSet[jj].Representation[jjj].id
                                            : NaN,
                                        mimeCodecs: mimeCodecsFromMpd,
                                        bandwidth: manifest.Period[j].AdaptationSet[jj].Representation[jjj].bandwidth != undefined ?
                                            manifest.Period[j].AdaptationSet[jj].Representation[jjj].bandwidth
                                            : NaN,
                                        width: manifest.Period[j].AdaptationSet[jj].Representation[jjj].width != undefined ?
                                            manifest.Period[j].AdaptationSet[jj].Representation[jjj].width
                                            : NaN,
                                        height: manifest.Period[j].AdaptationSet[jj].Representation[jjj].height != undefined ?
                                            manifest.Period[j].AdaptationSet[jj].Representation[jjj].height
                                            : NaN,
                                        segmentNum: NaN,
                                        // From SegmentTemplate
                                        duration: manifest.Period[j].AdaptationSet[jj].Representation[jjj].SegmentTemplate ?
                                            !isNaN(manifest.Period[j].AdaptationSet[jj].Representation[jjj].SegmentTemplate[0].duration) ?
                                                manifest.Period[j].AdaptationSet[jj].Representation[jjj].SegmentTemplate[0].duration
                                                : NaN
                                            : manifest.Period[j].AdaptationSet[jj].SegmentTemplate ?
                                                !isNaN(manifest.Period[j].AdaptationSet[jj].SegmentTemplate[0].duration) ?
                                                    manifest.Period[j].AdaptationSet[jj].SegmentTemplate[0].duration
                                                    : NaN
                                                :NaN,
                                        timescale: manifest.Period[j].AdaptationSet[jj].Representation[jjj].SegmentTemplate ?
                                            !isNaN(manifest.Period[j].AdaptationSet[jj].Representation[jjj].SegmentTemplate[0].timescale) ?
                                                manifest.Period[j].AdaptationSet[jj].Representation[jjj].SegmentTemplate[0].timescale
                                                : NaN
                                            : manifest.Period[j].AdaptationSet[jj].SegmentTemplate ?
                                                !isNaN(manifest.Period[j].AdaptationSet[jj].SegmentTemplate[0].timescale) ?
                                                    manifest.Period[j].AdaptationSet[jj].SegmentTemplate[0].timescale
                                                    : NaN
                                                :NaN,
                                        initialization: manifest.Period[j].AdaptationSet[jj].Representation[jjj].SegmentTemplate ?
                                            manifest.Period[j].AdaptationSet[jj].Representation[jjj].SegmentTemplate[0].initialization ?
                                                manifest.Period[j].AdaptationSet[jj].Representation[jjj].SegmentTemplate[0].initialization
                                                : NaN
                                            : manifest.Period[j].AdaptationSet[jj].SegmentTemplate ?
                                                manifest.Period[j].AdaptationSet[jj].SegmentTemplate[0].initialization ?
                                                    manifest.Period[j].AdaptationSet[jj].SegmentTemplate[0].initialization
                                                    : NaN
                                                :NaN,
                                        media: manifest.Period[j].AdaptationSet[jj].Representation[jjj].SegmentTemplate ?
                                            manifest.Period[j].AdaptationSet[jj].Representation[jjj].SegmentTemplate[0].media ?
                                                manifest.Period[j].AdaptationSet[jj].Representation[jjj].SegmentTemplate[0].media
                                                : NaN
                                            : manifest.Period[j].AdaptationSet[jj].SegmentTemplate ?
                                                manifest.Period[j].AdaptationSet[jj].SegmentTemplate[0].media ?
                                                    manifest.Period[j].AdaptationSet[jj].SegmentTemplate[0].media
                                                    : NaN
                                                :NaN,
                                        startNumber: manifest.Period[j].AdaptationSet[jj].Representation[jjj].SegmentTemplate ?
                                            !isNaN(manifest.Period[j].AdaptationSet[jj].Representation[jjj].SegmentTemplate[0].startNumber) ?
                                                manifest.Period[j].AdaptationSet[jj].Representation[jjj].SegmentTemplate[0].startNumber
                                                : NaN
                                            : manifest.Period[j].AdaptationSet[jj].SegmentTemplate ?
                                                !isNaN(manifest.Period[j].AdaptationSet[jj].SegmentTemplate[0].startNumber) ?
                                                    manifest.Period[j].AdaptationSet[jj].SegmentTemplate[0].startNumber
                                                    : NaN
                                                :NaN,
                                        availabilityTimeComplete: manifest.Period[j].AdaptationSet[jj].Representation[jjj].SegmentTemplate ?
                                            !isNaN(manifest.Period[j].AdaptationSet[jj].Representation[jjj].SegmentTemplate[0].availabilityTimeComplete) ?
                                                manifest.Period[j].AdaptationSet[jj].Representation[jjj].SegmentTemplate[0].availabilityTimeComplete
                                                : NaN
                                            : manifest.Period[j].AdaptationSet[jj].SegmentTemplate ?
                                                !isNaN(manifest.Period[j].AdaptationSet[jj].SegmentTemplate[0].availabilityTimeComplete) ?
                                                    manifest.Period[j].AdaptationSet[jj].SegmentTemplate[0].availabilityTimeComplete
                                                    : NaN
                                                :NaN,
                                        availabilityTimeOffset: manifest.Period[j].AdaptationSet[jj].Representation[jjj].SegmentTemplate ?
                                            !isNaN(manifest.Period[j].AdaptationSet[jj].Representation[jjj].SegmentTemplate[0].availabilityTimeOffset) ?
                                                manifest.Period[j].AdaptationSet[jj].Representation[jjj].SegmentTemplate[0].availabilityTimeOffset
                                                : NaN
                                            : manifest.Period[j].AdaptationSet[jj].SegmentTemplate ?
                                                !isNaN(manifest.Period[j].AdaptationSet[jj].SegmentTemplate[0].availabilityTimeOffset) ?
                                                    manifest.Period[j].AdaptationSet[jj].SegmentTemplate[0].availabilityTimeOffset
                                                    : NaN
                                                :NaN,
                                        // From SegmentTimeline of SegmentTemplate
                                        d: manifest.Period[j].AdaptationSet[jj].Representation[jjj].SegmentTemplate ?
                                            manifest.Period[j].AdaptationSet[jj].Representation[jjj].SegmentTemplate[0].SegmentTimeline ?
                                                manifest.Period[j].AdaptationSet[jj].Representation[jjj].SegmentTemplate[0].SegmentTimeline[0].S ?
                                                    !isNaN(manifest.Period[j].AdaptationSet[jj].Representation[jjj].SegmentTemplate[0].SegmentTimeline[0].S[0].d) ?
                                                        manifest.Period[j].AdaptationSet[jj].Representation[jjj].SegmentTemplate[0].SegmentTimeline[0].S[0].d
                                                        : NaN
                                                    : NaN
                                                : NaN 
                                            : manifest.Period[j].AdaptationSet[jj].SegmentTemplate ?
                                                manifest.Period[j].AdaptationSet[jj].SegmentTemplate[0].SegmentTimeline ?
                                                    manifest.Period[j].AdaptationSet[jj].SegmentTemplate[0].SegmentTimeline[0].S ?
                                                        !isNaN(manifest.Period[j].AdaptationSet[jj].SegmentTemplate[0].SegmentTimeline[0].S[0].d) ?
                                                            manifest.Period[j].AdaptationSet[jj].SegmentTemplate[0].SegmentTimeline[0].S[0].d
                                                            : NaN
                                                        : NaN
                                                    : NaN
                                                : NaN,
                                        r: manifest.Period[j].AdaptationSet[jj].Representation[jjj].SegmentTemplate ?
                                            manifest.Period[j].AdaptationSet[jj].Representation[jjj].SegmentTemplate[0].SegmentTimeline ?
                                                manifest.Period[j].AdaptationSet[jj].Representation[jjj].SegmentTemplate[0].SegmentTimeline[0].S ?
                                                    !isNaN(manifest.Period[j].AdaptationSet[jj].Representation[jjj].SegmentTemplate[0].SegmentTimeline[0].S[0].r) ?
                                                        manifest.Period[j].AdaptationSet[jj].Representation[jjj].SegmentTemplate[0].SegmentTimeline[0].S[0].r
                                                        : NaN
                                                    : NaN
                                                : NaN 
                                            : manifest.Period[j].AdaptationSet[jj].SegmentTemplate ?
                                                manifest.Period[j].AdaptationSet[jj].SegmentTemplate[0].SegmentTimeline ?
                                                    manifest.Period[j].AdaptationSet[jj].SegmentTemplate[0].SegmentTimeline[0].S ?
                                                        !isNaN(manifest.Period[j].AdaptationSet[jj].SegmentTemplate[0].SegmentTimeline[0].S[0].r) ?
                                                            manifest.Period[j].AdaptationSet[jj].SegmentTemplate[0].SegmentTimeline[0].S[0].r
                                                            : NaN
                                                        : NaN
                                                    : NaN
                                                : NaN,
                                        t: manifest.Period[j].AdaptationSet[jj].Representation[jjj].SegmentTemplate ?
                                            manifest.Period[j].AdaptationSet[jj].Representation[jjj].SegmentTemplate[0].SegmentTimeline ?
                                                manifest.Period[j].AdaptationSet[jj].Representation[jjj].SegmentTemplate[0].SegmentTimeline[0].S ?
                                                    !isNaN(manifest.Period[j].AdaptationSet[jj].Representation[jjj].SegmentTemplate[0].SegmentTimeline[0].S[0].t) ?
                                                        manifest.Period[j].AdaptationSet[jj].Representation[jjj].SegmentTemplate[0].SegmentTimeline[0].S[0].t
                                                        : 0
                                                    : 0
                                                : NaN 
                                            : manifest.Period[j].AdaptationSet[jj].SegmentTemplate ?
                                                manifest.Period[j].AdaptationSet[jj].SegmentTemplate[0].SegmentTimeline ?
                                                    manifest.Period[j].AdaptationSet[jj].SegmentTemplate[0].SegmentTimeline[0].S ?
                                                        !isNaN(manifest.Period[j].AdaptationSet[jj].SegmentTemplate[0].SegmentTimeline[0].S[0].t) ?
                                                            manifest.Period[j].AdaptationSet[jj].SegmentTemplate[0].SegmentTimeline[0].S[0].t
                                                            : 0
                                                        : 0
                                                    : NaN
                                                : NaN,
                                        // From manifest
                                        availabilityStartTime: manifest.availabilityStartTime || NaN,
                                        minimumUpdatePeriod: manifest.minimumUpdatePeriod || NaN,
                                        timeShiftBufferDepth: manifest.timeShiftBufferDepth || NaN
                                    };
                                    // Get segmentNum
                                    if (manifest.type == $scope.DYNAMIC) {
                                        $scope.streamBitrateList[contentType][i][j][jj][jjj].segmentNum = Infinity;
                                    } else {
                                        // Type 1: $Number$
                                        if (!isNaN($scope.streamBitrateList[contentType][i][j][jj][jjj].duration) && !isNaN($scope.streamBitrateList[contentType][i][j][jj][jjj].timescale)) {
                                            if (!isNaN(manifest.Period[j].duration)) {
                                                $scope.streamBitrateList[contentType][i][j][jj][jjj].segmentNum = Math.ceil(manifest.Period[j].duration / ($scope.streamBitrateList[contentType][i][j][jj][jjj].duration / $scope.streamBitrateList[contentType][i][j][jj][jjj].timescale));
                                            } else if (!isNaN(manifest.Period[j].start)) {
                                                let end = manifest.mediaPresentationDuration;
                                                for (let k = 0; k < manifest.Period.length; k++) {
                                                    if (manifest.Period[k].start > manifest.Period[j].start && manifest.Period[k].start < end) {
                                                        end = manifest.Period[k].start;
                                                    }
                                                }
                                                $scope.streamBitrateList[contentType][i][j][jj][jjj].segmentNum = Math.ceil((end - manifest.Period[j].start) / ($scope.streamBitrateList[contentType][i][j][jj][jjj].duration / $scope.streamBitrateList[contentType][i][j][jj][jjj].timescale));
                                            } else {
                                                if (manifest.Period.length == 1) {
                                                    $scope.streamBitrateList[contentType][i][j][jj][jjj].segmentNum = Math.ceil(manifest.mediaPresentationDuration / ($scope.streamBitrateList[contentType][i][j][jj][jjj].duration / $scope.streamBitrateList[contentType][i][j][jj][jjj].timescale));
                                                } else {
                                                    // TODO
                                                }
                                            }
                                        }
                                        // Type 2: $Time$
                                        else if (!isNaN($scope.streamBitrateList[contentType][i][j][jj][jjj].r) && $scope.streamBitrateList[contentType][i][j][jj][jjj].r != -1) {
                                            $scope.streamBitrateList[contentType][i][j][jj][jjj].segmentNum = $scope.streamBitrateList[contentType][i][j][jj][jjj].r;
                                        }
                                        else if (!isNaN($scope.streamBitrateList[contentType][i][j][jj][jjj].d) && !isNaN($scope.streamBitrateList[contentType][i][j][jj][jjj].timescale)) {
                                            if (!isNaN(manifest.Period[j].duration)) {
                                                $scope.streamBitrateList[contentType][i][j][jj][jjj].segmentNum = Math.ceil(manifest.Period[j].duration / ($scope.streamBitrateList[contentType][i][j][jj][jjj].d / $scope.streamBitrateList[contentType][i][j][jj][jjj].timescale));
                                            } else if (!isNaN(manifest.Period[j].start)) {
                                                let end = manifest.mediaPresentationDuration;
                                                for (let k = 0; k < manifest.Period.length; k++) {
                                                    if (manifest.Period[k].start > manifest.Period[j].start && manifest.Period[k].start < end) {
                                                        end = manifest.Period[k].start;
                                                    }
                                                }
                                                $scope.streamBitrateList[contentType][i][j][jj][jjj].segmentNum = Math.ceil((end - manifest.Period[j].start) / ($scope.streamBitrateList[contentType][i][j][jj][jjj].d / $scope.streamBitrateList[contentType][i][j][jj][jjj].timescale));
                                            } else {
                                                if (manifest.Period.length == 1) {
                                                    $scope.streamBitrateList[contentType][i][j][jj][jjj].segmentNum = Math.ceil(manifest.mediaPresentationDuration / ($scope.streamBitrateList[contentType][i][j][jj][jjj].d / $scope.streamBitrateList[contentType][i][j][jj][jjj].timescale));
                                                } else {
                                                    // TODO
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            return "SUCCESS";
        } catch (e) {
            return "registerBitrateList: " + e;
        }

    };

    // Register stream information
    $scope.registerFirstStreamInfo = function(manifest, contentType, i) {

        try {
            // Extract the current streamInfo
            var curStreamInfo = {};
            // baseUrl
            if (!manifest.baseUrl) {
                throw "No base URL in the MPD of path " + i + "!";
            }
            curStreamInfo.baseUrl = manifest.baseUrl;
            // pathIndex
            curStreamInfo.pathIndex = i;
            // periodIndex
            if (!manifest.Period || manifest.Period.length == 0) {
                throw "No period is available in path " + i + "!";
            }
            for (let j = 0; j < manifest.Period.length; j++) {
                if ((manifest.Period[j].start != undefined && manifest.Period[j].start == 0) || (manifest.Period[j].start == undefined && manifest.Period[j].id != undefined && manifest.Period[j].id == 0) || (manifest.Period[j].start == undefined && manifest.Period[j].id == undefined)) {
                    curStreamInfo.periodIndex = j;
                    // adaptationSetIndex
                    if (!manifest.Period[j].AdaptationSet || manifest.Period[j].AdaptationSet.length == 0) {
                        throw "No adaptation set is available in path " + i + ", period " + j + "!";
                    }
                    for (let jj = 0; jj < manifest.Period[j].AdaptationSet.length; jj++) {
                        if (manifest.Period[j].AdaptationSet[jj].contentType == contentType || (manifest.Period[j].AdaptationSet[jj].Representation != undefined && manifest.Period[j].AdaptationSet[jj].Representation[0].mimeType != undefined && manifest.Period[j].AdaptationSet[jj].Representation[0].mimeType.slice(0, 5) == contentType)) {
                            curStreamInfo.adaptationSetIndex = jj;
                            // representationIndex
                            let firstsmall;
                            for (let jjj = 0; jjj < manifest.Period[j].AdaptationSet[jj].Representation.length; jjj++) {
                                if ($scope.streamBitrateList[contentType] && $scope.streamBitrateList[contentType][i] && $scope.streamBitrateList[contentType][i][j] && $scope.streamBitrateList[contentType][i][j][jj] && $scope.streamBitrateList[contentType][i][j][jj][jjj] && $scope.streamBitrateList[contentType][i][j][jj][jjj].bandwidth) {
                                    if (!firstsmall) {
                                        firstsmall = { key: jjj, value: $scope.streamBitrateList[contentType][i][j][jj][jjj].bandwidth };
                                    } else {
                                        if ($scope.streamBitrateList[contentType][i][j][jj][jjj].bandwidth < firstsmall.value) {
                                            firstsmall = { key: jjj, value: $scope.streamBitrateList[contentType][i][j][jj][jjj].bandwidth };
                                        }
                                    }
                                }
                            }
                            if (firstsmall) {
                                if ($scope.streamBitrateList[contentType][i][j][jj][firstsmall.key].mimeCodecs) {
                                    curStreamInfo.representationIndex = firstsmall.key;
                                    // segmentIndex
                                    if (manifest.type == $scope.STATIC) {
                                        curStreamInfo.segmentIndex = $scope.streamBitrateList[contentType][i][j][jj][firstsmall.key].startNumber || 0;  /////////////////
                                    } else if (manifest.type == $scope.DYNAMIC) {
                                        let availabilityStartTime = $scope.streamBitrateList[contentType][i][j][jj][firstsmall.key].availabilityStartTime.getTime();
                                        let timeShiftBufferDepth = $scope.streamBitrateList[contentType][i][j][jj][firstsmall.key].timeShiftBufferDepth;
                                        let targetLatencyBias = $scope.targetLatencyBias > timeShiftBufferDepth ? timeShiftBufferDepth : $scope.targetLatencyBias;
                                        let now = new Date().getTime();
                                        let targetTime = Math.max(0, now - availabilityStartTime - (targetLatencyBias * 1000));
                                        let duration = ($scope.streamBitrateList[contentType][i][j][jj][firstsmall.key].duration || $scope.streamBitrateList[contentType][i][j][jj][firstsmall.key].d) / $scope.streamBitrateList[contentType][i][j][jj][firstsmall.key].timescale;
                                        curStreamInfo.segmentIndex = Math.floor(targetTime / (duration * 1000)) + ($scope.streamBitrateList[contentType][i][j][jj][firstsmall.key].startNumber || 0);  /////////////////
                                    }
                                    // lastSegmentIndex
                                    curStreamInfo.lastSegmentIndex = NaN;
                                    // mimeCodecs
                                    curStreamInfo.mimeCodecs = $scope.streamBitrateList[contentType][i][j][jj][firstsmall.key].mimeCodecs;
                                    break;
                                }
                            }
                        }
                        if (jj == manifest.Period[j].AdaptationSet.length - 1) {
                            throw "No adaptation set is suitable for the contentType!";
                        }
                    }
                    break;
                }
                if (j == manifest.Period.length - 1) {
                    throw "No period starts at 0!";
                }
            }

            // Create SourceBuffer
            if (!$scope.streamSourceBufferMimeCodecs[contentType] || ($scope.streamSourceBufferMimeCodecs[contentType] instanceof Array && !$scope.streamSourceBufferMimeCodecs[contentType][i])) {
                $scope.streamSourceBufferMimeCodecs[contentType] = curStreamInfo.mimeCodecs;
                // Only need either video or audio SourceBuffer
                if ($scope.streamNum[contentType == $scope.CONTENT_TYPE[0] ? $scope.CONTENT_TYPE[1] : $scope.CONTENT_TYPE[0]] == 0) {
                    if (!$scope.streamSourceBuffer[contentType]) {
                        $scope.streamSourceBuffer[contentType] = $scope.mediaSource.addSourceBuffer(curStreamInfo.mimeCodecs);
                    }
                    // Add event listeners:  1. append buffers from listeners   2. remove buffer periodly   3. update buffer levels
                    $scope.streamSourceBuffer[contentType].addEventListener($scope.EVENT_UPDATE_END, $scope.appendBuffer);
                    $scope.streamSourceBuffer[contentType].addEventListener($scope.EVENT_UPDATE_END, $scope.removeBuffer);
                    $scope.streamSourceBuffer[contentType].addEventListener($scope.EVENT_UPDATE_END, $scope.onBufferLevelUpdated);
                } 
                // Need both video and audio SourceBuffers
                else if ($scope.streamSourceBufferMimeCodecs[contentType == $scope.CONTENT_TYPE[0] ? $scope.CONTENT_TYPE[1] : $scope.CONTENT_TYPE[0]]) {
                    for (let j = 0; j < $scope.CONTENT_TYPE.length; j++) {
                        if (!$scope.streamSourceBuffer[$scope.CONTENT_TYPE[j]]) {
                            $scope.streamSourceBuffer[$scope.CONTENT_TYPE[j]] = $scope.mediaSource.addSourceBuffer($scope.streamSourceBufferMimeCodecs[$scope.CONTENT_TYPE[j]]);
                        }
                        // Add event listeners:  1. append buffers from listeners   2. remove buffer periodly   3. update buffer levels
                        $scope.streamSourceBuffer[$scope.CONTENT_TYPE[j]].addEventListener($scope.EVENT_UPDATE_END, $scope.appendBuffer);
                        $scope.streamSourceBuffer[$scope.CONTENT_TYPE[j]].addEventListener($scope.EVENT_UPDATE_END, $scope.removeBuffer);
                        $scope.streamSourceBuffer[$scope.CONTENT_TYPE[j]].addEventListener($scope.EVENT_UPDATE_END, $scope.onBufferLevelUpdated);
                    }
                }
            } else {
                console.log("The registeration of " + contentType + " " + i + " is aborted by streamSourceBufferMimeCodecs!");
                return "ABORT";
            }

            // Initialize settings and parameters
            $scope.streamInfo[contentType] = curStreamInfo;
            if (!$scope.streamDuration && manifest.mediaPresentationDuration) {
                $scope.streamDuration = manifest.mediaPresentationDuration;
                $scope.mediaSource.duration = manifest.mediaPresentationDuration;
            }
            if (!$scope.streamStartTime && manifest.availabilityStartTime && !$scope.streamTimeShiftDepth && manifest.timeShiftBufferDepth) {
                $scope.streamStartTime = manifest.availabilityStartTime;
                let nowMs = $scope.streamStartTime.getMilliseconds();
                nowMs = nowMs < 10 ? '00' + nowMs : nowMs < 100 ? '0' + nowMs : '' + nowMs;
                $scope.streamStartTimeFormatted = $scope.streamStartTime.toLocaleString() + '.' + nowMs;
                $scope.streamTimeShiftDepth = manifest.timeShiftBufferDepth;
                $scope.mediaSource.duration = Infinity;
            }
            if (isNaN($scope.streamIsDynamic)) {
                $scope.streamIsDynamic = manifest.type == $scope.STATIC ? false : manifest.type == $scope.DYNAMIC ? true : false;
            }
            $scope.autoSwitchTrack[contentType] = true;  // Use path switching as default
            $scope.autoSwitchBitrate[contentType] = true;  // Use ABR rules as default
            $scope.isStartup = false;
            $scope.isFetchingSegment[contentType] = false;
            $scope.isSeeking = false;    

            // Set the startup time of the player
            let now = new Date();
            let nowMs = now.getMilliseconds();
            nowMs = nowMs < 10 ? '00' + nowMs : nowMs < 100 ? '0' + nowMs : '' + nowMs;
            $scope.startupTime = now.getTime();
            $scope.startupTimeFormatted = now.toLocaleString() + '.' + nowMs;

            return "SUCCESS";
        } catch (e) {
            return "registerFirstStreamInfo: " + e;
        }

    };

    // Run when the segment need to be fetched from servers
    $scope.fetchSegment = function(contentType, urlType, pathIndex) {

        if ($scope.isFetchingSegment[contentType]) {
            return;
        }
        $scope.isFetchingSegment[contentType] = true;

        var curStreamInfo = {
            pathIndex: $scope.streamInfo[contentType].pathIndex,
            periodIndex: $scope.streamInfo[contentType].periodIndex,
            adaptationSetIndex: $scope.streamInfo[contentType].adaptationSetIndex,
            representationIndex: $scope.streamInfo[contentType].representationIndex,
            segmentIndex: $scope.streamInfo[contentType].segmentIndex,
            baseUrl: $scope.streamInfo[contentType].baseUrl,
            mimeCodecs: $scope.streamInfo[contentType].mimeCodecs,
            lastSegmentIndex: $scope.streamInfo[contentType].lastSegmentIndex
        };
        $scope.availabilityTimeOffset = $scope.streamBitrateList[contentType][curStreamInfo.pathIndex][curStreamInfo.periodIndex][curStreamInfo.adaptationSetIndex][curStreamInfo.representationIndex].availabilityTimeOffset || 0;
        if (urlType == $scope.TYPE_OF_INIT_SEGMENT && $scope.initCache[contentType][curStreamInfo.pathIndex][curStreamInfo.periodIndex][curStreamInfo.adaptationSetIndex][curStreamInfo.representationIndex]) {
            console.log("Init segment of " + contentType + " " + curStreamInfo.pathIndex + " period " + curStreamInfo.periodIndex + " adaptationSet " + curStreamInfo.adaptationSetIndex + " representation " + curStreamInfo.representationIndex + " is in the initCache!");
            // $scope.streamBufferToAppend[contentType].push($scope.initCache[contentType][curStreamInfo.pathIndex][curStreamInfo.periodIndex][curStreamInfo.adaptationSetIndex][curStreamInfo.representationIndex]);
            return;
        }
        var paramForResolveUrl = {
            id: $scope.streamBitrateList[contentType][curStreamInfo.pathIndex][curStreamInfo.periodIndex][curStreamInfo.adaptationSetIndex][curStreamInfo.representationIndex].id,
            t: $scope.streamBitrateList[contentType][curStreamInfo.pathIndex][curStreamInfo.periodIndex][curStreamInfo.adaptationSetIndex][curStreamInfo.representationIndex].t,
            d: $scope.streamBitrateList[contentType][curStreamInfo.pathIndex][curStreamInfo.periodIndex][curStreamInfo.adaptationSetIndex][curStreamInfo.representationIndex].d,
            segmentIndex: curStreamInfo.segmentIndex
        };
        var url = curStreamInfo.baseUrl;
        var urlExtend = urlType == $scope.TYPE_OF_INIT_SEGMENT ? $scope.streamBitrateList[contentType][curStreamInfo.pathIndex][curStreamInfo.periodIndex][curStreamInfo.adaptationSetIndex][curStreamInfo.representationIndex].initialization : urlType == $scope.TYPE_OF_MEDIA_SEGMENT ? $scope.streamBitrateList[contentType][curStreamInfo.pathIndex][curStreamInfo.periodIndex][curStreamInfo.adaptationSetIndex][curStreamInfo.representationIndex].media : "";
        var urlResolved = $scope.resolveUrl(urlType, url, urlExtend, paramForResolveUrl);
                
        console.log("Fetching " + urlType + ": Type " + contentType + ", Path " + curStreamInfo.pathIndex + ", Period " + curStreamInfo.periodIndex + ", AdaptationSet " + curStreamInfo.adaptationSetIndex + ", Representation " + curStreamInfo.representationIndex + (urlType == $scope.TYPE_OF_MEDIA_SEGMENT ? ", Segment " + curStreamInfo.segmentIndex + "." : "."));
        $scope.monitorDownloadingQuality[contentType] = $scope.streamBitrateList[contentType][curStreamInfo.pathIndex][curStreamInfo.periodIndex][curStreamInfo.adaptationSetIndex][curStreamInfo.representationIndex].bandwidth;
        
        if (urlType != $scope.TYPE_OF_MEDIA_SEGMENT || !$scope.llDashEnabled) {
            $scope.xmlLoader(contentType, urlResolved, $scope.RESPONSE_TYPE_OF_SEGMENT,
                // Function: onload
                (buffer, requestInfo) => {
                    if (isNaN($scope.isStartup)) {
                        console.log("The response has been thrown.");
                        return;
                    }
                    $scope.monitorRtt[contentType][curStreamInfo.pathIndex] = (requestInfo.tresponse - requestInfo.trequest).toFixed(0);
                    clearInterval($scope.intervalLifeSignalFunctions[contentType][curStreamInfo.pathIndex]);
                    $scope.intervalLifeSignalFunctions[contentType][curStreamInfo.pathIndex] = setInterval($scope.lifeSignalFetcher.bind(this, contentType, curStreamInfo.pathIndex), $scope.INTERVAL_OF_LIFE_SIGNAL_FETCHER);
                    $scope.loadSegment(buffer, contentType, curStreamInfo, urlType, pathIndex);
                    $scope.isFetchingSegment[contentType] = false;
                },
                // Function: onerror
                (status) => {
                    if (status == 404) {
                        console.log("No file(" + status + "): " + urlResolved);
                        $scope.isFetchingSegment[contentType] = false;
                        // $scope.streamInfo[contentType].segmentIndex = $scope.streamInfo[contentType].lastSegmentIndex;
                    }
                },
                pathIndex
            );
        } else {
            $scope.fetchLoader(contentType, urlResolved,
                // Function: progress
                (buffer, requestInfo) => {
                    if (isNaN($scope.isStartup)) {
                        console.log("The response has been thrown.");
                        return;
                    }
                    $scope.monitorRtt[contentType][curStreamInfo.pathIndex] = (requestInfo.tresponse - requestInfo.trequest).toFixed(0);
                    clearInterval($scope.intervalLifeSignalFunctions[contentType][curStreamInfo.pathIndex]);
                    $scope.intervalLifeSignalFunctions[contentType][curStreamInfo.pathIndex] = setInterval($scope.lifeSignalFetcher.bind(this, contentType, curStreamInfo.pathIndex), $scope.INTERVAL_OF_LIFE_SIGNAL_FETCHER);
                    $scope.streamBufferToAppend[contentType].push({
                        content: buffer,
                        curStreamInfo: curStreamInfo
                    });

                },
                // Function: onload
                (requestInfo) => {
                    if (isNaN($scope.isStartup)) {
                        console.log("The response has been thrown.");
                        return;
                    }
                    $scope.monitorRtt[contentType][curStreamInfo.pathIndex] = (requestInfo.tresponse - requestInfo.trequest).toFixed(0);
                    clearInterval($scope.intervalLifeSignalFunctions[contentType][curStreamInfo.pathIndex]);
                    $scope.intervalLifeSignalFunctions[contentType][curStreamInfo.pathIndex] = setInterval($scope.lifeSignalFetcher.bind(this, contentType, curStreamInfo.pathIndex), $scope.INTERVAL_OF_LIFE_SIGNAL_FETCHER);
                    $scope.loadSegment(null, contentType, curStreamInfo, urlType, pathIndex);
                    $scope.isFetchingSegment[contentType] = false;
                },
                pathIndex
            );
        }

    };

    // Load segments from responses and append to queue
    $scope.loadSegment = function(buffer, contentType, curStreamInfo, urlType, pathIndex) {

        if (buffer) {
            $scope.streamBufferToAppend[contentType].push({
                content: buffer,
                curStreamInfo: curStreamInfo
            });
        }
        if (urlType == $scope.TYPE_OF_INIT_SEGMENT) {  // Save in the cache if InitSegment
            $scope.initCache[contentType][curStreamInfo.pathIndex][curStreamInfo.periodIndex][curStreamInfo.adaptationSetIndex][curStreamInfo.representationIndex] = {
                content: buffer,
                mimeCodecs: curStreamInfo.mimeCodecs
            };
        } else if (urlType == $scope.TYPE_OF_MEDIA_SEGMENT) {    // Add buffered time if MediaSegment
            let streamInfo = $scope.streamInfo[contentType];
            streamInfo.lastSegmentIndex = streamInfo.segmentIndex;
            streamInfo.segmentIndex++;
            // Judge if continue, jump into the next period or end the stream
            if (streamInfo.segmentIndex
                    > $scope.streamBitrateList[contentType][streamInfo.pathIndex][streamInfo.periodIndex][streamInfo.adaptationSetIndex][streamInfo.representationIndex].segmentNum
                    + $scope.streamBitrateList[contentType][streamInfo.pathIndex][streamInfo.periodIndex][streamInfo.adaptationSetIndex][streamInfo.representationIndex].startNumber - 1) {
                let curPeriodIndex = streamInfo.periodIndex;
                let periodEnd = {
                    value: $scope.streamMpds[contentType][streamInfo.pathIndex].mediaPresentationDuration,
                    index: -1
                };
                for (let i = 0; i < $scope.streamMpds[contentType][streamInfo.pathIndex].Period.length; i++) {
                    if ($scope.streamMpds[contentType][streamInfo.pathIndex].Period[i].start != undefined && $scope.streamMpds[contentType][streamInfo.pathIndex].Period[i].start > $scope.streamMpds[contentType][streamInfo.pathIndex].Period[curPeriodIndex].start && $scope.streamMpds[contentType][streamInfo.pathIndex].Period[i].start < periodEnd.value) {
                        periodEnd.value = $scope.streamMpds[contentType][streamInfo.pathIndex].Period[i].start;
                        periodEnd.index = i;
                    } else if ($scope.streamMpds[contentType][streamInfo.pathIndex].Period[i].id != undefined && $scope.streamMpds[contentType][streamInfo.pathIndex].Period[i].id == $scope.streamMpds[contentType][streamInfo.pathIndex].Period[curPeriodIndex].id + 1) {
                        periodEnd.index = i;
                    }
                }
                if (periodEnd.index != -1) {
                    streamInfo.periodIndex = periodEnd.index;
                    streamInfo.segmentIndex = $scope.streamBitrateList[contentType][streamInfo.pathIndex][streamInfo.periodIndex][streamInfo.adaptationSetIndex][streamInfo.representationIndex].startNumber || 0;  //////////
                }
            }
        }
        $scope.scheduleFetcher(contentType, undefined);

    };

    // Create and load a XMLHttpRequest
    $scope.xmlLoader = function(contentType, url, responseType, onload, onerror, pathIndex) {

        if (!url) {
            // window.alert("The URL is invalid: " + url);
            console.log("The URL is invalid: " + url);
            return;
        }

        var requestInfo = {
            contentType: contentType,
            tsize: NaN,
            trequest: null,
            tresponse: null,
            tfinish: null,
            bufferLevel: NaN
        };
        var firstByteReceived = false;

        var xhr = new XMLHttpRequest();
        xhr.open($scope.HTTP_REQUEST_METHOD, url);
        xhr.responseType = responseType;  // 'text', 'arraybuffer'
        xhr.onload = function () {
            if (xhr.status == 200) {
                requestInfo.tfinish = performance.now();
                requestInfo.tsize = xhr.responseType == $scope.RESPONSE_TYPE_OF_MPD ? xhr.response.length : xhr.responseType == $scope.RESPONSE_TYPE_OF_SEGMENT ? xhr.response.byteLength * 8 : NaN;
                onload(xhr.response, requestInfo);
            }
        };
        xhr.onreadystatechange = function () {
            if (onerror && xhr.status == 404) {
                onerror(xhr.status);
                xhr.onreadystatechange = null;
            }
        };
        xhr.onprogress = function () {
            if (!firstByteReceived) {
                requestInfo.tresponse = performance.now();
                firstByteReceived = true;
            }
        };
        xhr.ontimeout = function () {
            if (onerror) {
                onerror(xhr.status);
            }
        };
        requestInfo.trequest = performance.now();
        requestInfo.bufferLevel = $scope.getBufferLevel(contentType, pathIndex);
        xhr.send();

    };

    // Create and load a fetch request
    $scope.fetchLoader = function(contentType, url, progress, onload, pathIndex) {

        var concatTypedArray = function (remaining, data) {
            if (remaining.length === 0) {
                return data;
            }
            const result = new Uint8Array(remaining.length + data.length);
            result.set(remaining);
            result.set(data, remaining.length);
            return result;
        };

        var reader;

        var read = function (response, processResult) {
            if (!reader) {
                throw "No reader!";
            }
            reader.read()
                .then(processResult)
                .catch(function (e) {
                    if (response.status === 200) {
                        console.log("Error in fetchLoader (with 200): " + e);
                    }
                });
        };

        if (!url) {
            // window.alert("The URL is invalid: " + url);
            console.log("The URL is invalid: " + url);
            return;
        }

        var requestInfo = {
            contentType: contentType,
            tsize: NaN,
            trequest: null,
            tresponse: null,
            tfinish: null,
            bufferLevel: NaN
        };
        var firstByteReceived = false;

        requestInfo.trequest = performance.now();
        requestInfo.bufferLevel = $scope.getBufferLevel(contentType, pathIndex);

        $scope.abortController[contentType] = new AbortController();
        var controllerTimeout = setTimeout(() => {
            $scope.abortController[contentType].abort();
            console.log("FetchLoader has stopped: " + url);
            $scope.fetchLoader(contentType, url, progress, onload, pathIndex);
        }, $scope.TIMEOUT_OF_FETCH_LOADER);

        fetch(url, { signal: $scope.abortController[contentType].signal }).then(function (response) {  // TODO: reqOptions (headers)
            
            clearTimeout(controllerTimeout);

            // Get the time of the first byte received
            if (!firstByteReceived) {
                requestInfo.tresponse = performance.now();
                firstByteReceived = true;
            }

            // Check the response
            if (!response.ok) {
                throw "Response is not OK!";
            }
            if (!response.body) {
                throw "Body is not supported!";
            }

            const totalBytes = parseInt(response.headers.get('Content-Length'), 10);
            let bytesReceived = 0;
            let signaledFirstByte = false;
            let remaining = new Uint8Array();
            let offset = 0;
            let lastChunkWasFinished = true;
            if (!reader) {
                reader = response.body.getReader();
            }

            // function: processResult
            const processResult = function ({ value, done}) {
                if (done) {
                    // if (remaining) {}
                    // Function: onload
                    requestInfo.tfinish = performance.now();
                    requestInfo.tsize = isNaN(totalBytes) ? bytesReceived : totalBytes;
                    $scope.abortController[contentType] = null;
                    onload(requestInfo);  /////////
                    return;
                }

                if (value && value.length > 0) {
                    remaining = concatTypedArray(remaining, value);
                    bytesReceived += value.length;

                    const boxesInfo = $scope.findLastTopIsoBoxCompleted(['moov', 'mdat'], remaining, offset);
                    if (boxesInfo.found) {
                        const end = boxesInfo.lastCompletedOffset + boxesInfo.size;

                        if (!lastChunkWasFinished) {
                            lastChunkWasFinished = true;
                        }

                        let data;
                        if (end === remaining.length) {
                            data = remaining;
                            remaining = new Uint8Array();
                        } else {
                            data = new Uint8Array(remaining.subarray(0, end));
                            remaining = remaining.subarray(end);
                        }

                        requestInfo.tsize = isNaN(totalBytes) ? bytesReceived : totalBytes;
                        progress(data, requestInfo);  /////////////////////

                        offset = 0;
                    } else {
                        offset = boxesInfo.lastCompletedOffset;
                        if (!signaledFirstByte) {
                            signaledFirstByte = true;
                        }
                    }
                }
                read(response, processResult);
            };
            read(response, processResult);

        }).catch(function (e) {
            console.log("Error in fetchLoader: " + e);
        });

    };


/////////////////////////////////////////////////////////////////////////////////////
/*                           Functions: assisted tools                             */
/////////////////////////////////////////////////////////////////////////////////////

    // Get the buffer level of videos/audios
    $scope.getBufferLevel = function(contentType, pathIndex) {  //////////////////////

        if ((contentType && isNaN(pathIndex) && !$scope.streamSourceBuffer[contentType]) || (contentType && !isNaN(pathIndex) && (!$scope.streamSourceBuffer[contentType] || !$scope.streamSourceBuffer[contentType][pathIndex]))) {
            return NaN;
        }
        var elementBuffered = contentType ? isNaN(pathIndex) ? $scope.streamSourceBuffer[contentType].buffered : $scope.streamSourceBuffer[contentType][pathIndex].buffered : $scope.streamElement.buffered;
        if (elementBuffered.length == 0) {
            return 0;
        }
        var curTime = contentType && !isNaN(pathIndex) ? $scope.streamElement[contentType][pathIndex].currentTime : $scope.streamElement.currentTime;
        for (let i = 0; i < elementBuffered.length; i++) {
            if (elementBuffered.start(i) <= curTime && elementBuffered.end(i) >= curTime) {
                return elementBuffered.end(i) - curTime;
            }
        }
        return 0;

    };

    // Get the buffer level of videos/audios as array
    $scope.getBufferLevelAsArray = function (contentType, pathIndex) {  //////////////////////

        if (!$scope.streamElement || (contentType && isNaN(pathIndex) && !$scope.streamSourceBuffer[contentType]) || (contentType && !isNaN(pathIndex) && !$scope.streamSourceBuffer[contentType][pathIndex])) {
            return NaN;
        }
        var elementBuffered = contentType ? isNaN(pathIndex) ? $scope.streamSourceBuffer[contentType].buffered : $scope.streamSourceBuffer[contentType][pathIndex].buffered : $scope.streamElement.buffered;
        var result = [];
        if (elementBuffered.length == 0) {
            return result;
        }
        for (let i = 0; i < elementBuffered.length; i++) {
            result.push({ start: elementBuffered.start(i), end: elementBuffered.end(i) });
        }
        return result;

    };

    // Checking paths of videos/audios
    $scope.checkPaths = function() {

        if (!($scope.streamNum.video || $scope.streamNum.audio)) {
            window.alert("Wrong streamNum.video/streamNum.audio: At least one path for fetching media!");
            return false;
        }

        for (let i = 0; i < $scope.CONTENT_TYPE.length; i++) {
            for (let j = 0; j < $scope.streamNum[$scope.CONTENT_TYPE[i]]; j++) {
                if (!$scope.streamURLs[$scope.CONTENT_TYPE[i]][j] || $scope.streamURLs[$scope.CONTENT_TYPE[i]][j] == "") {
                    window.alert("Wrong streamURLs." + $scope.CONTENT_TYPE[i] + "[" + j + "]: Empty URL in a path of " + $scope.CONTENT_TYPE[i] + "!");
                    return false;
                }
                if (!$scope.streamURLs[$scope.CONTENT_TYPE[i]][j] || $scope.streamURLs[$scope.CONTENT_TYPE[i]][j].slice(-4) !== ".mpd") {
                    window.alert("Wrong streamURLs." + $scope.CONTENT_TYPE[i] + "[" + j + "]: Not a .mpd URL in a path of " + $scope.CONTENT_TYPE[i] + "!");
                    return false;
                }
            }
        }

        return true;

    };

    // Extract MPD nodes from XML data
    $scope.parseManifest = function(node, path) {

        if (node.nodeType == $scope.DOM_NODE_TYPES.DOCUMENT_NODE) {  // Read the root node and its children nodes
            var result = new Object;
            var nodeChildren = node.childNodes;
            for (let i = 0; i < nodeChildren.length; i++) {
                var child = nodeChildren[i];
                if (child.nodeType == $scope.DOM_NODE_TYPES.ELEMENT_NODE) {
                    result = {};
                    result[child.localName] = $scope.parseManifest(child);
                }
            }
            return result;
        } else if (node.nodeType == $scope.DOM_NODE_TYPES.ELEMENT_NODE) {  // Read the element nodes and their children nodes
            var result = new Object;
            result.__cnt = 0;
            var nodeChildren = node.childNodes;
            
            // Extract children nodes
            for (let i = 0; i < nodeChildren.length; i++) {
                var child = nodeChildren[i];
                var childName = child.localName;
                if (child.nodeType != $scope.DOM_NODE_TYPES.COMMENT_NODE) {
                    var childPath = path + "." + childName;
                    result.__cnt++;
                    if (result[childName] == null) {
                        var c = $scope.parseManifest(child, childPath);
                        if (c != "") {
                            result[childName] = c;
                            result[childName] = [result[childName]];
                        }
                    } else {
                        if( !(result[childName] instanceof Array)) {
                            result[childName] = [result[childName]];
                        }
                        var c = $scope.parseManifest(child, childPath);
                        if (c != "") {
                            (result[childName])[result[childName].length] = c;
                        }
                    }
                }
            }

            // Extract attributes
            var nodeLocalName = node.localName;
            for (let i = 0; i < node.attributes.length; i++) {
                var attr = node.attributes[i];
                result.__cnt++;
                var value2 = attr.value;
                for (let j = 0; j < $scope.matchers.length; j++) {
                    var matchObj = $scope.matchers[j];  /////////////////////////////////
                    if (matchObj.test(attr, nodeLocalName)) {
                        value2 = matchObj.converter(attr.value);
                    }
                }
                result[attr.name] = value2;
            }

            // Extract node namespace prefix
            var nodePrefix = node.prefix;
            if (nodePrefix != null && nodePrefix != "") {
                result.__cnt++;
                result.__prefix = nodePrefix;
            }

            // Dealing with "#text" & "#cdata-section"
            if (result["#text"] != null) {
                result.__text = result["#text"];
                if(result.__text instanceof Array) {
                    result.__text = result.__text.join("\n");
                }
                delete result["#text"];
            }
            if (result["#cdata-section"] != null) {
                result.__cdata = result["#cdata-section"];
                delete result["#cdata-section"];
            }
            if (result.__cnt == 0) {
                result = '';
            } else if (result.__cnt == 1 && result.__text != null) {
                result = result.__text;
            } else if (result.__cnt == 1 && result.__cdata != null) {
                result = result.__cdata;
            } else if (result.__cnt > 1 && result.__text != null) {
                if (result.__text == "" || result.__text.trim() == "") {
                    delete result.__text;
                }
            }
            delete result.__cnt;

            return result;
        } else if (node.nodeType == $scope.DOM_NODE_TYPES.TEXT_NODE || node.nodeType == $scope.DOM_NODE_TYPES.CDATA_SECTION_NODE) {  // Read the text and cdata_section nodes
            return node.nodeValue.trim();
        }

    };

    // Dealing with url with urlType
    $scope.resolveUrl = function(urlType, url, urlExtend, paramForResolveUrl) {

        switch (urlType) {
            case $scope.TYPE_OF_MPD:
                var mergeUrl = NaN;
                if (url.slice(0, 7) == "http://" || url.slice(0, 8) == "https://") {  // Absolute address with http/https prefix
                    mergeUrl = url;
                } else if (url.slice(0, 2) == "./" || url.slice(0, 3) == "../") {  // Relative address
                    let baseUrl = window.location.href;
                    let tempUrl = url;
                    while (tempUrl.slice(0, 2) == "./" || tempUrl.slice(0, 3) == "../") {
                        if (tempUrl.slice(0, 2) == "./") {
                            tempUrl = tempUrl.slice(2);
                        } else if (tempUrl.slice(0, 3) == "../") {
                            tempUrl = tempUrl.slice(3);
                            if (baseUrl.slice(-1) == "/") {
                                baseUrl = baseUrl.slice(0, -1);
                            }
                            if (baseUrl.lastIndexOf("/") != -1 && baseUrl.lastIndexOf("/") != 0 && baseUrl[baseUrl.lastIndexOf("/") - 1] != "/") {
                                baseUrl = baseUrl.slice(0, baseUrl.lastIndexOf("/") + 1);
                            } else {
                                return "";
                            }
                        }
                    }
                    mergeUrl = baseUrl + tempUrl;
                } else {  // Absolute address without http/https prefix
                    mergeUrl = "http://" + url;  // Use http as default
                }
                return mergeUrl;
            case $scope.TYPE_OF_INIT_SEGMENT:
                try {
                    if (url == "") {
                        throw "No base URL!";
                    }
                    let tempUrlExtend = urlExtend;
                    while (tempUrlExtend.indexOf($scope.TAG_OF_REPRESENTATION_ID) != -1) {
                        tempUrlExtend = tempUrlExtend.replace($scope.TAG_OF_REPRESENTATION_ID, paramForResolveUrl.id);  // Replace representation ID in the URL
                    }
                    return url + tempUrlExtend;
                } catch (e) {
                    window.alert("Error when resolving URL of InitSegment: " + e);
                    return "";
                }
            case $scope.TYPE_OF_MEDIA_SEGMENT:
                try {
                    let numberMatcher = function (param, lenstr) {
                        let result = $scope.TAG_OF_SEGMENT_INDEX.indexOf("$Number") != -1 ? param.segmentIndex.toString() : (param.t + param.d * (param.segmentIndex - 1)).toString();
                        if (lenstr.indexOf("%") == -1) {
                            return result;
                        }
                        let len = parseInt(lenstr.slice(lenstr.indexOf("%") + 1, lenstr.indexOf("%") + 3));
                        while (result.length < len) {
                            result = "0" + result;
                        }
                        return result;
                    };

                    if (url == "") {
                        throw "No base URL!";
                    }
                    let tempUrlExtend = urlExtend;
                    while (tempUrlExtend.indexOf($scope.TAG_OF_REPRESENTATION_ID) != -1) {
                        tempUrlExtend = tempUrlExtend.replace($scope.TAG_OF_REPRESENTATION_ID, paramForResolveUrl.id);  // Replace representation ID in the URL
                    }
                    // Type 1: $Number$ / $Number%xxd$
                    while (tempUrlExtend.indexOf("$Number") != -1) {
                        $scope.TAG_OF_SEGMENT_INDEX = tempUrlExtend.slice(tempUrlExtend.indexOf("$Number"), tempUrlExtend.indexOf("$", tempUrlExtend.indexOf("$Number") + 1) + 1);
                        tempUrlExtend = tempUrlExtend.replace($scope.TAG_OF_SEGMENT_INDEX, numberMatcher(paramForResolveUrl, $scope.TAG_OF_SEGMENT_INDEX));  // Replace segment number in the URL
                    }
                    // Type 2: $Time$
                    while (tempUrlExtend.indexOf("$Time") != -1) {
                        $scope.TAG_OF_SEGMENT_INDEX = tempUrlExtend.slice(tempUrlExtend.indexOf("$Time"), tempUrlExtend.indexOf("$", tempUrlExtend.indexOf("$Time") + 1) + 1);
                        tempUrlExtend = tempUrlExtend.replace($scope.TAG_OF_SEGMENT_INDEX, numberMatcher(paramForResolveUrl, $scope.TAG_OF_SEGMENT_INDEX));  // Replace segment number in the URL
                    }
                    return url + tempUrlExtend;
                } catch (e) {
                    window.alert("Error when resolving URL of MediaSegment: " + e);
                    return "";
                }
            default:
                window.alert("Error when resolving URL of InitSegment/MediaSegment!");
                return "";
        }

    };

    // Convert time to time code
    $scope.convertToTimeCode = function (value) {

        value = Math.max(value, 0);

        let h = Math.floor(value / 3600);
        let m = Math.floor((value % 3600) / 60);
        let s = Math.floor((value % 3600) % 60);
        return (h === 0 ? '' : (h < 10 ? '0' + h.toString() + ':' : h.toString() + ':')) + (m < 10 ? '0' + m.toString() : m.toString()) + ':' + (s < 10 ? '0' + s.toString() : s.toString());

    };

    // dash.js: From the list of type boxes to look for, returns the latest one that is fully completed (header + payload)
    $scope.findLastTopIsoBoxCompleted = function (types, buffer, offset) {

        class IsoBoxSearchInfo {
            constructor(lastCompletedOffset, found, size) {
                this.lastCompletedOffset = lastCompletedOffset;
                this.found = found;
                this.size = size;
            }
        };

        var parseUint32 = function (data, offset) {
            return data[offset + 3] >>> 0 |
                (data[offset + 2] << 8) >>> 0 |
                (data[offset + 1] << 16) >>> 0 |
                (data[offset] << 24) >>> 0;
        };
    
        var parseIsoBoxType = function (data, offset) {
            return String.fromCharCode(data[offset++]) +
                String.fromCharCode(data[offset++]) +
                String.fromCharCode(data[offset++]) +
                String.fromCharCode(data[offset]);
        };

        if (offset === undefined) {
            offset = 0;
        }

        // 8 = size (uint32) + type (4 characters)
        if (!buffer || offset + 8 >= buffer.byteLength) {
            return new IsoBoxSearchInfo(0, false);
        }

        const data = (buffer instanceof ArrayBuffer) ? new Uint8Array(buffer) : buffer;
        let boxInfo;
        let lastCompletedOffset = 0;
        while (offset < data.byteLength) {
            const boxSize = parseUint32(data, offset);
            const boxType = parseIsoBoxType(data, offset + 4);

            if (boxSize === 0) {
                break;
            }

            if (offset + boxSize <= data.byteLength) {
                if (types.indexOf(boxType) >= 0) {
                    boxInfo = new IsoBoxSearchInfo(offset, true, boxSize);
                } else {
                    lastCompletedOffset = offset + boxSize;
                }
            }

            offset += boxSize;
        }

        if (!boxInfo) {
            return new IsoBoxSearchInfo(lastCompletedOffset, false);
        }

        return boxInfo;

    }


/////////////////////////////////////////////////////////////////////////////////////
/*                         Functions: intervals and events                         */
/////////////////////////////////////////////////////////////////////////////////////

    // Periodly check and append buffers, or triggered when updateend event happens
    $scope.appendBuffer = function() {

        for (let i = 0; i < $scope.CONTENT_TYPE.length; i++) {
            if ($scope.streamSourceBuffer[$scope.CONTENT_TYPE[i]] && !$scope.streamSourceBuffer[$scope.CONTENT_TYPE[i]].updating && $scope.streamBufferToAppend[$scope.CONTENT_TYPE[i]].length > 0) {
                // let elementBuffered = $scope.streamSourceBuffer[$scope.CONTENT_TYPE[i]].buffered;
                // for (let j = 0; j < elementBuffered.length; j++) {
                //     console.log($scope.CONTENT_TYPE[i] + "_" + j + ": " + elementBuffered.start(j) + " - " + elementBuffered.end(j) + ".");
                // }
                let buffer = $scope.streamBufferToAppend[$scope.CONTENT_TYPE[i]].shift();
                if ($scope.streamSourceBufferMimeCodecs[$scope.CONTENT_TYPE[i]] != buffer.curStreamInfo.mimeCodecs) {
                    $scope.streamSourceBuffer[$scope.CONTENT_TYPE[i]].changeType(buffer.curStreamInfo.mimeCodecs);
                    $scope.streamSourceBufferMimeCodecs[$scope.CONTENT_TYPE[i]] = buffer.curStreamInfo.mimeCodecs;
                }
                let bufferElement = {
                    bandwidth: $scope.streamBitrateList[$scope.CONTENT_TYPE[i]][buffer.curStreamInfo.pathIndex][buffer.curStreamInfo.periodIndex][buffer.curStreamInfo.adaptationSetIndex][buffer.curStreamInfo.representationIndex].bandwidth,
                    start: NaN,
                    end: NaN
                };
                if (!isNaN(buffer.curStreamInfo.segmentIndex)
                    && !isNaN($scope.streamBitrateList[$scope.CONTENT_TYPE[i]][buffer.curStreamInfo.pathIndex][buffer.curStreamInfo.periodIndex][buffer.curStreamInfo.adaptationSetIndex][buffer.curStreamInfo.representationIndex].duration)
                    && !isNaN($scope.streamBitrateList[$scope.CONTENT_TYPE[i]][buffer.curStreamInfo.pathIndex][buffer.curStreamInfo.periodIndex][buffer.curStreamInfo.adaptationSetIndex][buffer.curStreamInfo.representationIndex].startNumber)
                    && !isNaN($scope.streamBitrateList[$scope.CONTENT_TYPE[i]][buffer.curStreamInfo.pathIndex][buffer.curStreamInfo.periodIndex][buffer.curStreamInfo.adaptationSetIndex][buffer.curStreamInfo.representationIndex].timescale)) {
                    bufferElement.start = ($scope.streamMpds[$scope.CONTENT_TYPE[i]][buffer.curStreamInfo.pathIndex].Period[buffer.curStreamInfo.periodIndex].start || 0) 
                        + (buffer.curStreamInfo.segmentIndex - $scope.streamBitrateList[$scope.CONTENT_TYPE[i]][buffer.curStreamInfo.pathIndex][buffer.curStreamInfo.periodIndex][buffer.curStreamInfo.adaptationSetIndex][buffer.curStreamInfo.representationIndex].startNumber)
                        * ($scope.streamBitrateList[$scope.CONTENT_TYPE[i]][buffer.curStreamInfo.pathIndex][buffer.curStreamInfo.periodIndex][buffer.curStreamInfo.adaptationSetIndex][buffer.curStreamInfo.representationIndex].duration 
                        / $scope.streamBitrateList[$scope.CONTENT_TYPE[i]][buffer.curStreamInfo.pathIndex][buffer.curStreamInfo.periodIndex][buffer.curStreamInfo.adaptationSetIndex][buffer.curStreamInfo.representationIndex].timescale);
                    bufferElement.end = bufferElement.start + ($scope.streamBitrateList[$scope.CONTENT_TYPE[i]][buffer.curStreamInfo.pathIndex][buffer.curStreamInfo.periodIndex][buffer.curStreamInfo.adaptationSetIndex][buffer.curStreamInfo.representationIndex].duration 
                        / $scope.streamBitrateList[$scope.CONTENT_TYPE[i]][buffer.curStreamInfo.pathIndex][buffer.curStreamInfo.periodIndex][buffer.curStreamInfo.adaptationSetIndex][buffer.curStreamInfo.representationIndex].timescale);
                }
                if (!isNaN(buffer.curStreamInfo.segmentIndex)
                && !isNaN($scope.streamBitrateList[$scope.CONTENT_TYPE[i]][buffer.curStreamInfo.pathIndex][buffer.curStreamInfo.periodIndex][buffer.curStreamInfo.adaptationSetIndex][buffer.curStreamInfo.representationIndex].d)
                && !isNaN($scope.streamBitrateList[$scope.CONTENT_TYPE[i]][buffer.curStreamInfo.pathIndex][buffer.curStreamInfo.periodIndex][buffer.curStreamInfo.adaptationSetIndex][buffer.curStreamInfo.representationIndex].timescale)) {
                    bufferElement.start = ($scope.streamBitrateList[$scope.CONTENT_TYPE[i]][buffer.curStreamInfo.pathIndex][buffer.curStreamInfo.periodIndex][buffer.curStreamInfo.adaptationSetIndex][buffer.curStreamInfo.representationIndex].d
                        * (buffer.curStreamInfo.segmentIndex - 1) 
                        + ($scope.streamBitrateList[$scope.CONTENT_TYPE[i]][buffer.curStreamInfo.pathIndex][buffer.curStreamInfo.periodIndex][buffer.curStreamInfo.adaptationSetIndex][buffer.curStreamInfo.representationIndex].t || 0))
                        / $scope.streamBitrateList[$scope.CONTENT_TYPE[i]][buffer.curStreamInfo.pathIndex][buffer.curStreamInfo.periodIndex][buffer.curStreamInfo.adaptationSetIndex][buffer.curStreamInfo.representationIndex].timescale;
                    bufferElement.end = bufferElement.start + ($scope.streamBitrateList[$scope.CONTENT_TYPE[i]][buffer.curStreamInfo.pathIndex][buffer.curStreamInfo.periodIndex][buffer.curStreamInfo.adaptationSetIndex][buffer.curStreamInfo.representationIndex].d 
                        / $scope.streamBitrateList[$scope.CONTENT_TYPE[i]][buffer.curStreamInfo.pathIndex][buffer.curStreamInfo.periodIndex][buffer.curStreamInfo.adaptationSetIndex][buffer.curStreamInfo.representationIndex].timescale);    
                }
                $scope.monitorPlaybackQualityBuffer[$scope.CONTENT_TYPE[i]].push(bufferElement);
                $scope.streamSourceBuffer[$scope.CONTENT_TYPE[i]].appendBuffer(buffer.content);
            }
        }

    };

    // Periodly check and remove buffers
    $scope.removeBuffer = function() {

        for (let i = 0; i < $scope.CONTENT_TYPE.length; i++) {
            if ($scope.streamSourceBuffer[$scope.CONTENT_TYPE[i]] && !$scope.streamSourceBuffer[$scope.CONTENT_TYPE[i]].updating && $scope.streamElement.currentTime - $scope.maximalBuffer > 0) {
                $scope.streamSourceBuffer[$scope.CONTENT_TYPE[i]].remove(0, $scope.streamElement.currentTime - $scope.maximalBuffer);
            }
        }

    };

    // Fetch life signals intervally
    $scope.lifeSignalFetcher = function(contentType, pathIndex) {
        
        if (!$scope.lifeSignalEnabled) {
            return;
        }

        if ($scope.monitorRttForLifeSignal[contentType][pathIndex] == $scope.monitorRtt[contentType][pathIndex]) {
            $scope.xmlLoader(contentType, $scope.streamURLsForLifeSignals[contentType][pathIndex], $scope.RESPONSE_TYPE_OF_LIFE_SIGNAL,
                (buffer, requestInfo) => {
                    $scope.monitorRtt[contentType][pathIndex] = (requestInfo.tresponse - requestInfo.trequest).toFixed(0);
                    $scope.monitorRttForLifeSignal[contentType][pathIndex] = $scope.monitorRtt[contentType][pathIndex];
                },
                (status) => {
                    console.log("No life signal(" + status + "): " + $scope.streamURLs[contentType][pathIndex]);
                },
                undefined
            );
        } else {
            $scope.monitorRttForLifeSignal[contentType][pathIndex] = $scope.monitorRtt[contentType][pathIndex];
        }

    };

    // Fetch the segments periodly if isFetchingSegment is false
    $scope.scheduleFetcher = function(contentType, pathIndex) {
    
        // Autoplay
        if ($scope.isStartup === false) {
            let array = $scope.getBufferLevelAsArray();
            if (array.length > 0) {
                $scope.streamElement.currentTime = array[0].start;
                try {
                    $scope.streamElement.play();
                    $scope.isStartup = true;
                } catch (e) {
                    console.log("Wrong when autoplay: " + e);
                }
            }
        }

        let bufferLevel = $scope.getBufferLevel(contentType, pathIndex);
        let bufferToAppend = 0;
        let streamBufferToAppend = $scope.streamBufferToAppend[contentType] || [];
        let streamInfo = $scope.streamInfo[contentType];
        for (let i = 0; i < streamBufferToAppend.length; i++) {
            let buffer = streamBufferToAppend[i];
            bufferToAppend += ($scope.streamBitrateList[contentType][buffer.curStreamInfo.pathIndex][buffer.curStreamInfo.periodIndex][buffer.curStreamInfo.adaptationSetIndex][buffer.curStreamInfo.representationIndex].duration
                || $scope.streamBitrateList[contentType][buffer.curStreamInfo.pathIndex][buffer.curStreamInfo.periodIndex][buffer.curStreamInfo.adaptationSetIndex][buffer.curStreamInfo.representationIndex].d)
                / $scope.streamBitrateList[contentType][buffer.curStreamInfo.pathIndex][buffer.curStreamInfo.periodIndex][buffer.curStreamInfo.adaptationSetIndex][buffer.curStreamInfo.representationIndex].timescale;
        }
        if ($scope.streamSourceBuffer[contentType]
                && !$scope.isSeeking
                && !$scope.isFetchingSegment[contentType]
                && !isNaN(bufferLevel) && (bufferLevel + bufferToAppend) < $scope.targetBuffer
                && !isNaN($scope.streamBitrateList[contentType][streamInfo.pathIndex][streamInfo.periodIndex][streamInfo.adaptationSetIndex][streamInfo.representationIndex].segmentNum) 
                && streamInfo.segmentIndex <= $scope.streamBitrateList[contentType][streamInfo.pathIndex][streamInfo.periodIndex][streamInfo.adaptationSetIndex][streamInfo.representationIndex].segmentNum) {
            // Adjust the streamInfo by ABR rules
            if ($scope.autoSwitchBitrate[contentType] && $scope.autoSwitchTrack[contentType] && $scope.abrRules.hasOwnProperty($scope.selectedRule)) {
                $scope.streamInfo[contentType] = $scope.abrRules[$scope.selectedRule].setStreamInfo(streamInfo, contentType);
            }
            // Fetch InitSegment and MediaSegment
            if ($scope.initCache[contentType][streamInfo.pathIndex][streamInfo.periodIndex][streamInfo.adaptationSetIndex][streamInfo.representationIndex]) {
                $scope.fetchSegment(contentType, $scope.TYPE_OF_MEDIA_SEGMENT, pathIndex);
            } else {
                $scope.fetchSegment(contentType, $scope.TYPE_OF_INIT_SEGMENT, pathIndex);
            }
        }

    };

    // Observe latency and adjust playback rate to catch up
    $scope.setPlaybackRate = function () {

        if (!$scope.streamIsDynamic || !$scope.catchupEnabled) {
            return;
        }

        if ($scope.streamElement.currentTime < $scope.baselineTime - $scope.targetLatencyBias - $scope.minDrift) {
            $scope.streamElement.playbackRate = 1 + $scope.catchupPlaybackRate;
        } else if ($scope.streamElement.currentTime > $scope.baselineTime - $scope.targetLatencyBias + $scope.minDrift) {
            $scope.streamElement.playbackRate = 1 - $scope.catchupPlaybackRate;
        } else {
            $scope.streamElement.playbackRate = 1;
        }

    };

    // Adjust target latency bias automatically to decrease buffer level
    $scope.setTargetLatencyBias = function () {

        if (!$scope.streamIsDynamic || !$scope.autoAdjustingLatencyBias) {
            return;
        }

        var buffer = Infinity;
        buffer = $scope.getBufferLevel();

        if (buffer > 1) {
            $scope.targetLatencyBias -= 1;
        } else if (buffer > $scope.minDrift * 2) {
            $scope.targetLatencyBias -= 0.1;
        } else if (buffer < $scope.minDrift) {
            $scope.targetLatencyBias += 0.1;
        }

    };

    // Update the buffer level in the control bar and restart playback periodly
    $scope.onBufferLevelUpdated = function () {

        if ($scope.controllBar && $scope.controllBar.onBufferLevelUpdated) {
            $scope.controllBar.onBufferLevelUpdated();
        }

        if ($scope.forcedPause || !$scope.streamElement) {
            return;
        }

        let buffer = $scope.getBufferLevel();
        if (buffer > 0 && $scope.streamElement.paused) {
            $scope.streamElement.play();
        }

    };

    // Update the timeline in the control bar periodly
    $scope.onPlaybackTimeUpdate = function () {
        
        if ($scope.controllBar && $scope.controllBar.onPlaybackTimeUpdate) {
            $scope.controllBar.onPlaybackTimeUpdate();
        }

    };

    // Triggered when the player plays
    $scope.onSetPauseBtn = function () {

        if ($scope.forcedPause) {
            return;
        }
        if ($scope.stallFlag) {
            $scope.stallTime += ((new Date().getTime()) - $scope.stallFlag) / 1000;
            $scope.stallFlag = NaN;
        }
        if ($scope.controllBar && $scope.controllBar.setPauseBtn) {
            $scope.controllBar.setPauseBtn();
        }

    };
    
    // Triggered when the player stops or waits
    $scope.onSetPlayBtn = function () {

        if ($scope.forcedPause) {
            return;
        }
        $scope.stallFlag = new Date().getTime();
        // if ($scope.mode == "CMP") {
        //     for (let i = 0; i < $scope.CONTENT_TYPE.length; i++) {
        //         for (let j = 0; j < $scope.streamNum[$scope.CONTENT_TYPE[i]]; j++) {
        //             $scope.streamElement[$scope.CONTENT_TYPE[i]][j].pause();
        //         }
        //     }
        // }
        if ($scope.controllBar && $scope.controllBar.setPlayBtn) {
            $scope.controllBar.setPlayBtn();
        }

    };

    // Other platform intervals
    $scope.platformInterval = setInterval(() => {

        let now = new Date();
        let nowMs = now.getMilliseconds();
        nowMs = nowMs < 10 ? '00' + nowMs : nowMs < 100 ? '0' + nowMs : '' + nowMs;
        $scope.utcTime = now.getTime();
        $scope.utcTimeFormatted = now.toLocaleString() + '.' + nowMs;
        $scope.baselineTime = $scope.streamStartTime ? (new Date().getTime() - $scope.streamStartTime.getTime()) / 1000 + ($scope.availabilityTimeOffset || 0) : null;

        // For testing
        // if (($scope.startupTime ? ($scope.utcTime - $scope.startupTime) / 1000 : 0) > 310) {
        //     window.alert($scope.stallTime);
        //     clearInterval($scope.platformInterval);
        // }

    }, $scope.INTERVAL_OF_PLATFORM_ADJUSTMENT);

    // setInterval(() => {
    //     try {
    //         const po = new PerformanceObserver((list) => {
    //             let temp = list.getEntries();
    //             for (const entry of temp) {
    //                 console.log('Time to first byte', entry.responseStart);
    //             }
    //         });
    //         po.observe({type: 'resource', buffered: true});
    //     } catch (e) {
    //         console.log('No supported Performance Observer!');
    //     }
    // }, 1000);

}]);