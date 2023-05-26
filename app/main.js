//////////////////////////////// InRaysee DASH Player ////////////////////////////////
/*
TODOs:
  [ ] 1. ABR rules.
  [ ] 2. Path switching.
  [ ] 3. Reload.
  [ ] 4. Multiple stream URLs.
  [ ] 5. Data monitors, figures and stats.
  [ ] 6. Module spliting.
  [ ] 7. Multiple periods and different segment indexs.
  [ ] 8. Live mode with catchup.
  [ ] 9. VR mode.
*/
//////////////////////////////////////////////////////////////////////////////////////

var app = angular.module('DashPlayer', ['angular-flot']);

app.controller('DashController', function ($scope) {

/////////////////////////////////////////////////////////////////////////////////////
    $scope.INTERVAL_OF_APPEND_BUFFER_FROM_INTERVAL = 100;
    $scope.TYPE_OF_MPD = "MPD";
    $scope.TYPE_OF_INIT_SEGMENT = "InitSegment";
    $scope.TYPE_OF_MEDIA_SEGMENT = "MediaSegment";
    $scope.EVENT_TIME_UPDATE = "timeupdate";
    $scope.EVENT_UPDATE_END = "updateend";
    $scope.TAG_OF_REPRESENTATION_ID = "$RepresentationID$";
    $scope.TAG_OF_SEGMENT_INDEX = "$Number%05d$";
    $scope.RESPONSE_TYPE_OF_MPD = "text";
    $scope.RESPONSE_TYPE_OF_SEGMENT = "arraybuffer";
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
        lowestBitrateRule: new LowestBitrateRuleClass(),
        globalSwitchRule: new GlobalSwitchRuleClass()
    };

    $scope.mediaSource = null;  // Container for the MediaSource object
    $scope.streamElement = null;  // Container for video element in HTML page
    $scope.controllBar = null;  // Container for video control bar
    $scope.streamSourceBuffer = {  // Containers for SourceBuffers
        video: null,
        audio: null
    };
    $scope.streamBufferToAppend = {  // Queues of buffers to append
        video: [],
        audio: []
    };
    $scope.initCache = {  // Cache of init segments loaded
        video: [],
        audio: []
    };

    $scope.streamNum = {  // Number of paths for fetching streams
        video: 6,
        audio: 1
    }
    $scope.streamMpds = {  // Arrays of MPDs
        video: [],
        audio: []
    };
    $scope.streamBitrateLists = {  // Arrays of bitrate lists
        video: [],
        audio: []
    };

    $scope.streamInfo = {  // Information of streams selected
        video: {
            pathIndex: NaN,
            periodIndex: NaN,
            adaptationSetIndex: NaN,
            representationIndex: NaN,
            segmentIndex: NaN,
            baseUrl: NaN,
            mimeCodecs: NaN,
            lastSegmentIndex: NaN
        },
        audio: {
            pathIndex: NaN,
            periodIndex: NaN,
            adaptationSetIndex: NaN,
            representationIndex: NaN,
            segmentIndex: NaN,
            baseUrl: NaN,
            mimeCodecs: NaN,
            lastSegmentIndex: NaN
        }
    };

    $scope.streamDuration = NaN;  // Total duration of the stream
    $scope.streamIsDynamic = NaN;  // Live mode when true, otherwise VOD mode
    $scope.autoSwitchTrack = {  // Flags for judging if the tracks are auto switched
        video: NaN,
        audio: NaN
    };
    $scope.autoSwitchBitrate = {  // Flags for judging if the bitrates are auto switched
        video: NaN,
        audio: NaN
    };
    $scope.isFetchingSegment = {  // Flag for identifying if fetching the segment
        video: NaN,
        audio: NaN
    };
    $scope.isSeeking = NaN;

    $scope.targetBuffer = 2;  // The buffer level desired to be fetched
    $scope.scheduleInterval = 50;  // Interval of triggering schedule fetcher to start requests
    $scope.globalQuality = {  // Switch the quality by global manual switching ABR strategy
        video: 0,
        audio: 0
    };
/////////////////////////////////////////////////////////////////////////////////////

    //// Global variables (containers: cannot adjust mannually)

    $scope.players = [];  // Container for DASH players
    $scope.controllBar = null;  // Container for controllbars
    $scope.buffer_empty_flag = [];  // Flags for players, showing whether the player is frozen or not
    $scope.forcedPause = false;  // Flag for player to identify whether stop mannually or not
    $scope.lon = NaN, $scope.lat = NaN;  // Longitude and latitude in spherical coordinates
    $scope.clientServerTimeShift = 0;  // Time shift between client and server from TimelineConverter
    $scope.totalQOE = NaN;  // Compute the QoE considering all players (TODO)
    $scope.startupTime = 0;  // Startup time of streaming
    $scope.startupTimeFormatted = null;  // Formatted startup time of streaming
    $scope.normalizedTime = NaN;  // Set the fastest mediaplayer's timeline as the normalized time
    $scope.totalThroughput = NaN;  // Compute the total throughput considering all players
    $scope.currentPathID = NaN;  // Current path ID
    $scope.playerBufferLength = [];  // Data from monitor
    $scope.playerAverageThroughput = [];  // Data from monitor
    $scope.playerTime = [];  // Data from monitor
    $scope.loadedTime = [];  // Data from monitor
    $scope.playerDownloadingQuality = [];  // Data from monitor
    $scope.playerPlaybackQuality = [];  // Data from monitor
    $scope.playerPastDownloadingQuality = [];  // Data from monitor's playerDownloadingQuality
    $scope.playerCatchUp = [];  // Data from playback controller
    $scope.playerRTT = [];  // Data from monitor
    $scope.playerBitrateList = [];  // Data from bitrate list
    $scope.playerLastBitrateList = [];  // Data from bitrate list
    $scope.playerTotalBitrateList = [];  // Data from bitrate list
    $scope.requestList = [];  // Data from all HTTPRequests
    $scope.requestListLength = 0;  // Data from all HTTPRequests
    $scope.multiPathQuality = [0, 0, 0, 0, 0, 0];  // For Switching the quality by manual switching ABR strategy and multipath ABR strategy
    $scope.previousmultiPathQuality = [0, 0, 0, 0, 0, 0];  // For Switching the quality by manual switching ABR strategy and multipath ABR strategy
    $scope.changeQualityFlag = [0, 0, 0, 0, 0, 0];  // For Switching the quality by manual switching ABR strategy and multipath ABR strategy


    //// Global variables (private: only adjust in codes)

    $scope.IntervalOfPlatformAdjustment = 10;  // [For setting interval] Set the interval time for platform interval function
    $scope.IntervalOfSetNormalizedTime = 10;  // [For setting interval] Set the fastest mediaplayer's timeline as the normalized time
    $scope.IntervalOfComputetotalThroughput = 1000;  // [For setting interval] Compute total throughput according to recent HTTP requests
    $scope.IntervalOfComputeQoE = 1000;  // [For setting interval] Compute QoE
    $scope.IntervalOfUpdateStats = 100;  // [For setting interval] Show the data in monitor
    $scope.IntervalOfUpdateFigures = 500;  // [For setting interval] Show the data in figures
    $scope.IntervalOfUpdateRequestsFigures = 100;  // [For setting interval] Show the requests data in figures
    $scope.IntervalOfCaptures = 100;  // [For setting interval] Capture the pictures from mediaplayers
    $scope.IntervalOfSwitchPath = 100;  // [For setting interval] Switch the best path according to players' qualities
    $scope.IntervalOfApplyOptions = 1000;  // [For setting interval] Apply parameters in options
    $scope.IntervalOfUpdateMultiPathQualities = 1000;  // [For setting interval] Set up the qualities when using MultiPathRule
    $scope.GET_SAMPLE_WINDOW_SIZE_FOR_RTT = 5;  // Set up the window size for calculating RTT
    $scope.drawmycanvas = {  // Set the width and height of the capture pictures
        "width": "150",
        "height": "150"
    };
    // $scope.mycanvas = {  // Set the width and height of the canvases
    //     "width":"150px",
    //     "height":"150px"
    // };
    $scope.requestDuration = 3000;  // [For computing total throughput] Set the duration we consider (ms)
    $scope.requestLayBack = 0;  // [For computing total throughput] Set the lay-back time for avoiding the on-going requests (ms)
    $scope.playerBufferToKeep = 4;  // Allows you to modify the buffer that is kept in source buffer in seconds
    $scope.playerStableBufferTime = 4;  // The time that the internal buffer target will be set to post startup/seeks (NOT top quality)
    $scope.playerBufferTimeAtTopQuality = 4;  // The time that the internal buffer target will be set to once playing the top quality
    $scope.playerBufferTimeAtTopQualityLongForm = 4;  // The time that the internal buffer target will be set to once playing the top quality for a long form
    $scope.lambdaQOE = 1.0;  // [For computing QoE] Value of the quality switches constant
    $scope.qQOE = 'log';  // [For computing QoE] a mapping function that translates the bitrate of chunk to the quality perceived by the user (Linear || Log)
    $scope.availableStreams = [  // All the available preset media sources
        {
            name:"VOD (Akamai BBB)",
            url:"https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd"
        },
        {
            name:"VOD (Captions by WebVTT)",
            url:"https://dash.akamaized.net/akamai/test/caption_test/ElephantsDream/elephants_dream_480p_heaac5_1_https.mpd"
        },
        {
            name:"VOD (Multi periods)",
            url:"https://media.axprod.net/TestVectors/v8-MultiContent/Clear/Manifest.mpd"
        },
        {
            name:"VOD (Local CMPVP907)",
            urls:[
                "http://localhost:8080/datasets/CMPVP907/face0/output/stream.mpd",
                "http://localhost:8080/datasets/CMPVP907/face1/output/stream.mpd",
                "http://localhost:8080/datasets/CMPVP907/face2/output/stream.mpd",
                "http://localhost:8080/datasets/CMPVP907/face3/output/stream.mpd",
                "http://localhost:8080/datasets/CMPVP907/face4/output/stream.mpd",
                "http://localhost:8080/datasets/CMPVP907/face5/output/stream.mpd",
                "http://localhost:8080/datasets/CMPVP907/audio/output/stream.mpd"
            ]
        },
        {
            name:"VOD (Local tokyo)",
            urls:[
                "http://localhost:8080/datasets/tokyo/v9/stream.mpd",
                "http://localhost:8080/datasets/tokyo/v9/stream.mpd",
                "http://localhost:8080/datasets/tokyo/v9/stream.mpd",
                "http://localhost:8080/datasets/tokyo/v9/stream.mpd",
                "http://localhost:8080/datasets/tokyo/v9/stream.mpd",
                "http://localhost:8080/datasets/tokyo/v9/stream.mpd",
                "http://localhost:8080/datasets/tokyo/v9/stream.mpd"
            ]
        },
        {
            name:"VOD (Local apple)",
            urls:[
                "http://localhost:8080/datasets/apple/v9/stream.mpd",
                "http://localhost:8080/datasets/apple/v9/stream.mpd",
                "http://localhost:8080/datasets/apple/v9/stream.mpd",
                "http://localhost:8080/datasets/apple/v9/stream.mpd",
                "http://localhost:8080/datasets/apple/v9/stream.mpd",
                "http://localhost:8080/datasets/apple/v9/stream.mpd",
                "http://localhost:8080/datasets/apple/v9/stream.mpd"
            ]
        },
        {
            name:"VOD (File BBB)",
            urls:[
                "http://222.20.126.108:8080/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                "http://222.20.126.108:8080/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                "http://222.20.126.108:8080/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                "http://222.20.126.108:8080/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                "http://222.20.126.108:8080/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                "http://222.20.126.108:8080/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                "http://222.20.126.108:8080/ffz/akamai/bbb_30fps/bbb_30fps.mpd"
            ]
        },
        {
            name:"VOD (File tokyo)",
            urls:[
                "http://222.20.126.108:8080/ffz/tokyo/v9/stream.mpd",
                "http://222.20.126.108:8080/ffz/tokyo/v9/stream.mpd",
                "http://222.20.126.108:8080/ffz/tokyo/v9/stream.mpd",
                "http://222.20.126.108:8080/ffz/tokyo/v9/stream.mpd",
                "http://222.20.126.108:8080/ffz/tokyo/v9/stream.mpd",
                "http://222.20.126.108:8080/ffz/tokyo/v9/stream.mpd",
                "http://222.20.126.108:8080/ffz/tokyo/v9/stream.mpd"
            ]
        },
        {
            name:"VOD (File apple)",
            urls:[
                "http://222.20.126.108:8080/ffz/apple/v9/stream.mpd",
                "http://222.20.126.108:8080/ffz/apple/v9/stream.mpd",
                "http://222.20.126.108:8080/ffz/apple/v9/stream.mpd",
                "http://222.20.126.108:8080/ffz/apple/v9/stream.mpd",
                "http://222.20.126.108:8080/ffz/apple/v9/stream.mpd",
                "http://222.20.126.108:8080/ffz/apple/v9/stream.mpd",
                "http://222.20.126.108:8080/ffz/apple/v9/stream.mpd"
            ]
        },
        {
            name:"VOD (File Docker BBB)",
            urls:[
                "http://222.20.126.108:6001/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                "http://222.20.126.108:6003/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                "http://222.20.126.108:6005/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                "http://222.20.126.108:6007/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                "http://222.20.126.108:6009/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                "http://222.20.126.108:6011/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                "http://222.20.126.108:6001/ffz/akamai/bbb_30fps/bbb_30fps.mpd"
            ]
        },
        {
            name:"VOD (File Docker tokyo)",
            urls:[
                "http://222.20.126.108:6001/ffz/tokyo/v9/stream.mpd",
                "http://222.20.126.108:6003/ffz/tokyo/v9/stream.mpd",
                "http://222.20.126.108:6005/ffz/tokyo/v9/stream.mpd",
                "http://222.20.126.108:6007/ffz/tokyo/v9/stream.mpd",
                "http://222.20.126.108:6009/ffz/tokyo/v9/stream.mpd",
                "http://222.20.126.108:6011/ffz/tokyo/v9/stream.mpd",
                "http://222.20.126.108:6001/ffz/tokyo/v9/stream.mpd"
            ]
        },
        {
            name:"VOD (File Docker apple)",
            urls:[
                "http://222.20.126.108:6001/ffz/apple/v9/stream.mpd",
                "http://222.20.126.108:6003/ffz/apple/v9/stream.mpd",
                "http://222.20.126.108:6005/ffz/apple/v9/stream.mpd",
                "http://222.20.126.108:6007/ffz/apple/v9/stream.mpd",
                "http://222.20.126.108:6009/ffz/apple/v9/stream.mpd",
                "http://222.20.126.108:6011/ffz/apple/v9/stream.mpd",
                "http://222.20.126.108:6001/ffz/apple/v9/stream.mpd"
            ]
        },
        {
            name:"VOD (Edge BBB)",
            urls:[
                "http://222.20.126.109:8080/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                "http://222.20.126.109:8080/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                "http://222.20.126.109:8080/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                "http://222.20.126.109:8080/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                "http://222.20.126.109:8080/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                "http://222.20.126.109:8080/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                "http://222.20.126.109:8080/ffz/akamai/bbb_30fps/bbb_30fps.mpd"
            ]
        },
        {
            name:"VOD (Edge tokyo)",
            urls:[
                "http://222.20.126.109:8080/ffz/tokyo/v9/stream.mpd",
                "http://222.20.126.109:8080/ffz/tokyo/v9/stream.mpd",
                "http://222.20.126.109:8080/ffz/tokyo/v9/stream.mpd",
                "http://222.20.126.109:8080/ffz/tokyo/v9/stream.mpd",
                "http://222.20.126.109:8080/ffz/tokyo/v9/stream.mpd",
                "http://222.20.126.109:8080/ffz/tokyo/v9/stream.mpd",
                "http://222.20.126.109:8080/ffz/tokyo/v9/stream.mpd"
            ]
        },
        {
            name:"VOD (Edge apple)",
            urls:[
                "http://222.20.126.109:8080/ffz/apple/v9/stream.mpd",
                "http://222.20.126.109:8080/ffz/apple/v9/stream.mpd",
                "http://222.20.126.109:8080/ffz/apple/v9/stream.mpd",
                "http://222.20.126.109:8080/ffz/apple/v9/stream.mpd",
                "http://222.20.126.109:8080/ffz/apple/v9/stream.mpd",
                "http://222.20.126.109:8080/ffz/apple/v9/stream.mpd",
                "http://222.20.126.109:8080/ffz/apple/v9/stream.mpd"
            ]
        },
        {
            name:"VOD (Edge Docker BBB)",
            urls:[
                "http://222.20.126.109:6001/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                "http://222.20.126.109:6003/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                "http://222.20.126.109:6005/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                "http://222.20.126.109:6007/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                "http://222.20.126.109:6009/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                "http://222.20.126.109:6011/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                "http://222.20.126.109:6001/ffz/akamai/bbb_30fps/bbb_30fps.mpd"
            ]
        },
        {
            name:"VOD (Edge Docker tokyo)",
            urls:[
                "http://222.20.126.109:6001/ffz/tokyo/v9/stream.mpd",
                "http://222.20.126.109:6003/ffz/tokyo/v9/stream.mpd",
                "http://222.20.126.109:6005/ffz/tokyo/v9/stream.mpd",
                "http://222.20.126.109:6007/ffz/tokyo/v9/stream.mpd",
                "http://222.20.126.109:6009/ffz/tokyo/v9/stream.mpd",
                "http://222.20.126.109:6011/ffz/tokyo/v9/stream.mpd",
                "http://222.20.126.109:6001/ffz/tokyo/v9/stream.mpd"
            ]
        },
        {
            name:"VOD (Edge Docker apple)",
            urls:[
                "http://222.20.126.109:6001/ffz/apple/v9/stream.mpd",
                "http://222.20.126.109:6003/ffz/apple/v9/stream.mpd",
                "http://222.20.126.109:6005/ffz/apple/v9/stream.mpd",
                "http://222.20.126.109:6007/ffz/apple/v9/stream.mpd",
                "http://222.20.126.109:6009/ffz/apple/v9/stream.mpd",
                "http://222.20.126.109:6011/ffz/apple/v9/stream.mpd",
                "http://222.20.126.109:6001/ffz/apple/v9/stream.mpd"
            ]
        },
        {
            name:"VOD (Zerotier File BBB)",
            urls:[
                "http://172.28.0.53:8080/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                "http://172.28.0.53:8080/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                "http://172.28.0.53:8080/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                "http://172.28.0.53:8080/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                "http://172.28.0.53:8080/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                "http://172.28.0.53:8080/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                "http://172.28.0.53:8080/ffz/akamai/bbb_30fps/bbb_30fps.mpd"
            ]
        },
        {
            name:"VOD (Zerotier File tokyo)",
            urls:[
                "http://172.28.0.53:8080/ffz/tokyo/v9/stream.mpd",
                "http://172.28.0.53:8080/ffz/tokyo/v9/stream.mpd",
                "http://172.28.0.53:8080/ffz/tokyo/v9/stream.mpd",
                "http://172.28.0.53:8080/ffz/tokyo/v9/stream.mpd",
                "http://172.28.0.53:8080/ffz/tokyo/v9/stream.mpd",
                "http://172.28.0.53:8080/ffz/tokyo/v9/stream.mpd",
                "http://172.28.0.53:8080/ffz/tokyo/v9/stream.mpd"
            ]
        },
        {
            name:"VOD (Zerotier File apple)",
            urls:[
                "http://172.28.0.53:8080/ffz/apple/v9/stream.mpd",
                "http://172.28.0.53:8080/ffz/apple/v9/stream.mpd",
                "http://172.28.0.53:8080/ffz/apple/v9/stream.mpd",
                "http://172.28.0.53:8080/ffz/apple/v9/stream.mpd",
                "http://172.28.0.53:8080/ffz/apple/v9/stream.mpd",
                "http://172.28.0.53:8080/ffz/apple/v9/stream.mpd",
                "http://172.28.0.53:8080/ffz/apple/v9/stream.mpd"
            ]
        },
        {
            name:"VOD (Zerotier File Docker BBB)",
            urls:[
                "http://172.28.0.53:6001/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                "http://172.28.0.53:6003/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                "http://172.28.0.53:6005/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                "http://172.28.0.53:6007/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                "http://172.28.0.53:6009/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                "http://172.28.0.53:6011/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                "http://172.28.0.53:6001/ffz/akamai/bbb_30fps/bbb_30fps.mpd"
            ]
        },
        {
            name:"VOD (Zerotier File Docker tokyo)",
            urls:[
                "http://172.28.0.53:6001/ffz/tokyo/v9/stream.mpd",
                "http://172.28.0.53:6003/ffz/tokyo/v9/stream.mpd",
                "http://172.28.0.53:6005/ffz/tokyo/v9/stream.mpd",
                "http://172.28.0.53:6007/ffz/tokyo/v9/stream.mpd",
                "http://172.28.0.53:6009/ffz/tokyo/v9/stream.mpd",
                "http://172.28.0.53:6011/ffz/tokyo/v9/stream.mpd",
                "http://172.28.0.53:6001/ffz/tokyo/v9/stream.mpd"
            ]
        },
        {
            name:"VOD (Zerotier File Docker apple)",
            urls:[
                "http://172.28.0.53:6001/ffz/apple/v9/stream.mpd",
                "http://172.28.0.53:6003/ffz/apple/v9/stream.mpd",
                "http://172.28.0.53:6005/ffz/apple/v9/stream.mpd",
                "http://172.28.0.53:6007/ffz/apple/v9/stream.mpd",
                "http://172.28.0.53:6009/ffz/apple/v9/stream.mpd",
                "http://172.28.0.53:6011/ffz/apple/v9/stream.mpd",
                "http://172.28.0.53:6001/ffz/apple/v9/stream.mpd"
            ]
        },
        {
            name:"VOD (Zerotier Edge BBB)",
            urls:[
                "http://172.28.0.54:8080/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                "http://172.28.0.54:8080/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                "http://172.28.0.54:8080/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                "http://172.28.0.54:8080/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                "http://172.28.0.54:8080/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                "http://172.28.0.54:8080/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                "http://172.28.0.54:8080/ffz/akamai/bbb_30fps/bbb_30fps.mpd"
            ]
        },
        {
            name:"VOD (Zerotier Edge tokyo)",
            urls:[
                "http://172.28.0.54:8080/ffz/tokyo/v9/stream.mpd",
                "http://172.28.0.54:8080/ffz/tokyo/v9/stream.mpd",
                "http://172.28.0.54:8080/ffz/tokyo/v9/stream.mpd",
                "http://172.28.0.54:8080/ffz/tokyo/v9/stream.mpd",
                "http://172.28.0.54:8080/ffz/tokyo/v9/stream.mpd",
                "http://172.28.0.54:8080/ffz/tokyo/v9/stream.mpd",
                "http://172.28.0.54:8080/ffz/tokyo/v9/stream.mpd"
            ]
        },
        {
            name:"VOD (Zerotier Edge apple)",
            urls:[
                "http://172.28.0.54:8080/ffz/apple/v9/stream.mpd",
                "http://172.28.0.54:8080/ffz/apple/v9/stream.mpd",
                "http://172.28.0.54:8080/ffz/apple/v9/stream.mpd",
                "http://172.28.0.54:8080/ffz/apple/v9/stream.mpd",
                "http://172.28.0.54:8080/ffz/apple/v9/stream.mpd",
                "http://172.28.0.54:8080/ffz/apple/v9/stream.mpd",
                "http://172.28.0.54:8080/ffz/apple/v9/stream.mpd"
            ]
        },
        {
            name:"VOD (Zerotier Edge Docker BBB)",
            urls:[
                "http://172.28.0.54:6001/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                "http://172.28.0.54:6003/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                "http://172.28.0.54:6005/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                "http://172.28.0.54:6007/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                "http://172.28.0.54:6009/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                "http://172.28.0.54:6011/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                "http://172.28.0.54:6001/ffz/akamai/bbb_30fps/bbb_30fps.mpd"
            ]
        },
        {
            name:"VOD (Zerotier Edge Docker tokyo)",
            urls:[
                "http://172.28.0.54:6001/ffz/tokyo/v9/stream.mpd",
                "http://172.28.0.54:6003/ffz/tokyo/v9/stream.mpd",
                "http://172.28.0.54:6005/ffz/tokyo/v9/stream.mpd",
                "http://172.28.0.54:6007/ffz/tokyo/v9/stream.mpd",
                "http://172.28.0.54:6009/ffz/tokyo/v9/stream.mpd",
                "http://172.28.0.54:6011/ffz/tokyo/v9/stream.mpd",
                "http://172.28.0.54:6001/ffz/tokyo/v9/stream.mpd"
            ]
        },
        {
            name:"VOD (Zerotier Edge Docker apple)",
            urls:[
                "http://172.28.0.54:6001/ffz/apple/v9/stream.mpd",
                "http://172.28.0.54:6003/ffz/apple/v9/stream.mpd",
                "http://172.28.0.54:6005/ffz/apple/v9/stream.mpd",
                "http://172.28.0.54:6007/ffz/apple/v9/stream.mpd",
                "http://172.28.0.54:6009/ffz/apple/v9/stream.mpd",
                "http://172.28.0.54:6011/ffz/apple/v9/stream.mpd",
                "http://172.28.0.54:6001/ffz/apple/v9/stream.mpd"
            ]
        },
        {
            name:"LIVE (Livesim Single Rate)",
            url:"https://livesim.dashif.org/livesim/chunkdur_1/ato_7/testpic4_8s/Manifest300.mpd"
        },
        {
            name:"LIVE (Cmafref Multi Rates)",
            url:"https://cmafref.akamaized.net/cmaf/live-ull/2006350/akambr/out.mpd"
        },
        {
            name:"LIVE (FileServer)",
            url:"http://222.20.126.108:8000/dash/stream.mpd"
        },
        {
            name:"LIVE (EdgeServer)",
            url:"http://222.20.126.109:8000/dash/stream.mpd"
        },
        {
            name:"LIVE (FS & ES)",
            urls:[
                "http://222.20.126.108:8000/face0/stream.mpd",
                "http://222.20.126.108:8000/face1/stream.mpd",
                "http://222.20.126.108:8000/face2/stream.mpd",
                "http://222.20.126.109:8000/face3/stream.mpd",
                "http://222.20.126.109:8000/face4/stream.mpd",
                "http://222.20.126.109:8000/face5/stream.mpd",
                "http://222.20.126.108:8000/face0/stream.mpd"
            ]
        },
        {
            name:"COPY"
        },
        {
            name:"CUSTOM"
        }
    ];


    //// Global variables (public: adjust by users)

    $scope.optionButton = "Show Options";  // Save the state of option button
    $scope.selectedRule = "highestBitrateRule";  // Save the selected ABR strategy
    $scope.selectedMode = 'Multi-Path';  // Save the selected mode
    $scope.targetLatency = 10;  // The live delay allowed
    $scope.minDrift = 0.02;  // The minimal latency deviation allowed
    $scope.maxDrift = 3;  // The maximal latency deviation allowed
    $scope.catchupPlaybackRate = 0.5;  // Catchup playback rate
    $scope.liveCatchupLatencyThreshold = 60;  // Maximal latency allowed to catch up
    $scope.pathSwitchStrategy = 3;  // ID of path switching strategy
    $scope.preferredPathID = 1;  // Switch the path of stream manually
    $scope.preferredSyncDelay = 0.5;  // Set the tolerance of sync delay (s)
    $scope.lifeSignalEnabled = true;  // Whether discard the lowest bitrate as life signals or not
    $scope.videoURLs = [  // Save the selected media source
        "http://localhost:8080/apple/v9/stream.mpd",
        "http://localhost:8080/apple/v9/stream.mpd",
        "http://localhost:8080/apple/v9/stream.mpd",
        "http://localhost:8080/apple/v9/stream.mpd",
        "http://localhost:8080/apple/v9/stream.mpd",
        "http://localhost:8080/apple/v9/stream.mpd"
    ];
    $scope.audioURLs = [  // Save the selected media source
        "http://localhost:8080/apple/v9/stream.mpd"
];


    //// Global variables (stat & chart related)

    $scope.stats = [];  // Save all the stats need to put on the charts
    $scope.chartData_downloadingQuality = [];  // Save the downloading qualtiy data need to put on the charts
    $scope.chartData_playbackQuality = [];  // Save the playback qualtiy data need to put on the charts
    $scope.chartData_buffer = [];  // Save the buffer data need to put on the charts
    $scope.chartData_throughput = [];  // Save the throughput data need to put on the charts
    $scope.chartData_RTT = [];  // Save the RTT data need to put on the charts
    $scope.chartData_requests = [];  // Save the requests data need to put on the charts
    $scope.maxDownloadingQualityBuffer = [];  // Buffer for maximal chart data
    $scope.maxPlaybackQualityBuffer = [];  // Buffer for maximal chart data
    $scope.maxBufferBuffer = [];  // Buffer for maximal chart data
    $scope.maxThroughputBuffer = [];  // Buffer for maximal chart data
    $scope.maxRTTBuffer = [];  // Buffer for maximal chart data
    $scope.maxDownloadingQuality = 0;  // Maximal chart data
    $scope.maxPlaybackQuality = 0;  // Maximal chart data
    $scope.maxBuffer = 0;  // Maximal chart data
    $scope.maxThroughput = 0;  // Maximal chart data
    $scope.maxRTT = 0;  // Maximal chart data
    $scope.maxRequests = 0;  // Maximal chart data
    $scope.maxPointsToChart = 30;  // Set the maximum of the points printed on the charts
    $scope.chartColor = ['#00CCBE', '#ffd446', '#FF6700', '#44c248', '#ff000a', '#b300ff', '#1100ff'];  // Colors of each objects (6 + 1 as maximum)
    $scope.chartState = {  // Save the charts' states
        downloadingQuality:{},
        playbackQuality:{},
        buffer:{},
        throughput:{},
        RTT:{},
        requests:{}
    };
    $scope.chartOptions_downloadingQuality = {  // Set up the style of the charts
        legend: {
            labelBoxBorderColor: '#ffffff',
            placement: 'outsideGrid',
            container: '#legend-wrapper'
        },
        series: {
            lines: {
                show: true,
                lineWidth: 2,
                shadowSize: 1,
                steps: false,
                fill: false
            },
            points: {
                radius: 4,
                fill: true,
                show: true
            }
        },
        grid: {
            clickable: false,
            hoverable: false,
            autoHighlight: true,
            color: '#136bfb',
            backgroundColor: '#ffffff'
        },
        axisLabels: {
            position: 'left'
        },
        xaxis: {
            tickFormatter: function tickFormatter(value) {
                return $scope.players[0].convertToTimeCode(value);
            },
            tickDecimals: 0,
            color: '#136bfb',
            alignTicksWithAxis: 1
        },
        yaxis: {
            min: 0,
            max: $scope.maxDownloadingQuality,
            tickLength: 0,
            tickDecimals: 0,
            color: '#136bfb',
            position: 'right',
            axisLabelPadding: 10
        },
        yaxes: [{ axisLabel: "level" }]
    };
    $scope.chartOptions_playbackQuality = {  // [For printing the chart] Set up the style of the charts
        legend: {
            labelBoxBorderColor: '#ffffff',
            placement: 'outsideGrid',
            container: '#legend-wrapper'
        },
        series: {
            lines: {
                show: true,
                lineWidth: 2,
                shadowSize: 1,
                steps: false,
                fill: false
            },
            points: {
                radius: 4,
                fill: true,
                show: true
            }
        },
        grid: {
            clickable: false,
            hoverable: false,
            autoHighlight: true,
            color: '#136bfb',
            backgroundColor: '#ffffff'
        },
        axisLabels: {
            position: 'left'
        },
        xaxis: {
            tickFormatter: function tickFormatter(value) {
                return $scope.players[0].convertToTimeCode(value);
            },
            tickDecimals: 0,
            color: '#136bfb',
            alignTicksWithAxis: 1
        },
        yaxis: {
            min: 0,
            max: $scope.maxPlaybackQuality,
            tickLength: 0,
            tickDecimals: 0,
            color: '#136bfb',
            position: 'right',
            axisLabelPadding: 10
        },
        yaxes: [{ axisLabel: "level" }]
    };
    $scope.chartOptions_buffer = {  // [For printing the chart] Set up the style of the charts
        legend: {
            labelBoxBorderColor: '#ffffff',
            placement: 'outsideGrid',
            container: '#legend-wrapper'
        },
        series: {
            lines: {
                show: true,
                lineWidth: 2,
                shadowSize: 1,
                steps: false,
                fill: false
            },
            points: {
                radius: 4,
                fill: true,
                show: true
            }
        },
        grid: {
            clickable: false,
            hoverable: false,
            autoHighlight: true,
            color: '#136bfb',
            backgroundColor: '#ffffff'
        },
        axisLabels: {
            position: 'left'
        },
        xaxis: {
            tickFormatter: function tickFormatter(value) {
                return $scope.players[0].convertToTimeCode(value);
            },
            tickDecimals: 0,
            color: '#136bfb',
            alignTicksWithAxis: 1
        },
        yaxis: {
            min: 0,
            max: $scope.maxBuffer,
            tickLength: 0,
            tickDecimals: 0,
            color: '#136bfb',
            position: 'right',
            axisLabelPadding: 10
        },
        yaxes: [{axisLabel: "second"}]
    };
    $scope.chartOptions_throughput = {  // [For printing the chart] Set up the style of the charts
        legend: {
            labelBoxBorderColor: '#ffffff',
            placement: 'outsideGrid',
            container: '#legend-wrapper'
        },
        series: {
            lines: {
                show: true,
                lineWidth: 2,
                shadowSize: 1,
                steps: false,
                fill: false
            },
            points: {
                radius: 4,
                fill: true,
                show: true
            }
        },
        grid: {
            clickable: false,
            hoverable: false,
            autoHighlight: true,
            color: '#136bfb',
            backgroundColor: '#ffffff'
        },
        axisLabels: {
            position: 'left'
        },
        xaxis: {
            tickFormatter: function tickFormatter(value) {
                return $scope.players[0].convertToTimeCode(value);
            },
            tickDecimals: 0,
            color: '#136bfb',
            alignTicksWithAxis: 1
        },
        yaxis: {
            min: 0,
            max: $scope.maxThroughput,
            tickLength: 0,
            tickDecimals: 0,
            color: '#136bfb',
            position: 'right',
            axisLabelPadding: 10
        },
        yaxes: [{axisLabel: "kbps"}]
    };
    $scope.chartOptions_RTT = {  // [For printing the chart] Set up the style of the charts
        legend: {
            labelBoxBorderColor: '#ffffff',
            placement: 'outsideGrid',
            container: '#legend-wrapper'
        },
        series: {
            lines: {
                show: true,
                lineWidth: 2,
                shadowSize: 1,
                steps: false,
                fill: false
            },
            points: {
                radius: 4,
                fill: true,
                show: true
            }
        },
        grid: {
            clickable: false,
            hoverable: false,
            autoHighlight: true,
            color: '#136bfb',
            backgroundColor: '#ffffff'
        },
        axisLabels: {
            position: 'left'
        },
        xaxis: {
            tickFormatter: function tickFormatter(value) {
                return $scope.players[0].convertToTimeCode(value);
            },
            tickDecimals: 0,
            color: '#136bfb',
            alignTicksWithAxis: 1
        },
        yaxis: {
            min: 0,
            max: $scope.maxRTT,
            tickLength: 0,
            tickDecimals: 0,
            color: '#136bfb',
            position: 'right',
            axisLabelPadding: 10
        },
        yaxes: [{axisLabel: "millisecond"}]
    };
    $scope.chartOptions_requests = {  // [For printing the chart] Set up the style of the charts
        legend: {
            labelBoxBorderColor: '#ffffff',
            placement: 'outsideGrid',
            container: '#legend-wrapper'
        },
        series: {
            lines: {
                show: true,
                lineWidth: 2,
                shadowSize: 1,
                steps: false,
                fill: false
            },
            points: {
                radius: 4,
                fill: true,
                show: true
            }
        },
        grid: {
            clickable: false,
            hoverable: false,
            autoHighlight: true,
            color: '#136bfb',
            backgroundColor: '#ffffff'
        },
        axisLabels: {
            position: 'left'
        },
        xaxis: {
            // tickFormatter: function tickFormatter(value) {
            //     return $scope.players[0].convertToTimeCode(value);
            // },
            tickDecimals: 0,
            color: '#136bfb',
            alignTicksWithAxis: 1
        },
        yaxis: {
            min: 0,
            // max: $scope.maxRequests,
            tickLength: 0,
            tickDecimals: 0,
            color: '#136bfb',
            position: 'right',
            axisLabelPadding: 10
        },
        yaxes: [{ axisLabel: "level" }]
    };


    //// Functions: UI and options

    // Setting up media sources
    $scope.setStream = function (item, num) {
        switch (num) {
            case 0:
            case 1:
            case 2:
            case 3:
            case 4:
            case 5:
                $scope.videoURLs[num] = item.url ? item.url : item.urls[num];
                break;
            case 6:
                $scope.audioURLs[0] = item.url ? item.url : item.urls[num];
                break;
            case 7:
                if (item.name == "COPY") {
                    for (let i = 0; i < $scope.streamNum.video; i++) {
                        if ($scope.videoURLs[i] != "") {
                            for (let j = 0; j < $scope.streamNum.video; j++) {
                                if (i != j) {
                                    $scope.videoURLs[j] = $scope.videoURLs[i];
                                }
                            }
                            return;
                        }
                    }
                } else {
                    if (item.name == "CUSTOM") {
                        $scope.videoURLs[0] = "";
                        $scope.videoURLs[1] = "";
                        $scope.videoURLs[2] = "";
                        $scope.videoURLs[3] = "";
                        $scope.videoURLs[4] = "";
                        $scope.videoURLs[5] = "";
                        $scope.audioURLs[0] = "";
                    } else {
                        if (item.url) {
                            $scope.videoURLs[0] = item.url;
                            $scope.videoURLs[1] = item.url;
                            $scope.videoURLs[2] = item.url;
                            $scope.videoURLs[3] = item.url;
                            $scope.videoURLs[4] = item.url;
                            $scope.videoURLs[5] = item.url;
                            $scope.audioURLs[0] = item.url;
                        } else {
                            $scope.videoURLs[0] = item.urls[0];
                            $scope.videoURLs[1] = item.urls[1];
                            $scope.videoURLs[2] = item.urls[2];
                            $scope.videoURLs[3] = item.urls[3];
                            $scope.videoURLs[4] = item.urls[4];
                            $scope.videoURLs[5] = item.urls[5];
                            $scope.audioURLs[0] = item.urls[6];
                        }
                    }
                }
                break;
            default:
                break;
        }
    };

    // Showing/hiding options
    $scope.showoption = function () {
        if($scope.optionButton == "Show Options"){
            document.getElementById('option').style = "border: 3px solid #136bfb; margin-top: 7px; z-index: 1000; position: block; width: 100%;";
            $scope.optionButton = "Hide Options";
        }else{
            document.getElementById('option').style = "display: none;";
            $scope.optionButton = "Show Options";
        }
    };

    // Changing the streaming mode
    $scope.changeMode = function (mode) {
        switch (mode) {
            case 'Multi-Path':
                $scope.selectedMode = 'Multi-Path';
                document.getElementById( "videoContainerVR" ).style.display = "none";
                document.getElementById( "videoContainer" ).style.display = "block";
                document.getElementById( "FOVRule" ).disabled = "true";
                document.getElementById( "DefaultRule" ).checked = true;
                $scope.changeABRStrategy('DefaultRule');
                document.getElementById( "video_num_1" ).removeAttribute("disabled");
                document.getElementById( "video_num_2" ).removeAttribute("disabled");
                document.getElementById( "video_num_3" ).removeAttribute("disabled");
                document.getElementById( "video_num_4" ).removeAttribute("disabled");
                document.getElementById( "video_num_5" ).removeAttribute("disabled");
                document.getElementById( "video_num_6" ).removeAttribute("disabled");
                document.getElementById( "path_select_0" ).checked = true;
                $scope.changePathStrategy(0);
                document.getElementById( "path_select_0" ).removeAttribute("disabled");
                document.getElementById( "path_select_1" ).removeAttribute("disabled");
                document.getElementById( "path_select_2" ).removeAttribute("disabled");
                document.getElementById( "path_select_3" ).removeAttribute("disabled");
                document.getElementById( "path_select_4" ).disabled = "true";
                document.getElementById( "currentPathIDDisplay" ).style.display = "block";
                document.getElementById( "currentPathQualityDisplay" ).style.display = "block";
                document.getElementById( "currentLongitude" ).style.display = "none";
                document.getElementById( "currentLatitude" ).style.display = "none";
                document.getElementById( "life_signal" ).removeAttribute("disabled");
                break;
            case 'VR':
                $scope.selectedMode = 'VR';
                document.getElementById( "videoContainerVR" ).style.display = "block";
                document.getElementById( "videoContainer" ).style.display = "none";
                document.getElementById( "FOVRule" ).removeAttribute("disabled");
                document.getElementById( "FOVRule" ).checked = true;
                $scope.changeABRStrategy('FOVRule');
                document.getElementById( "video_num_6" ).checked = true;
                $scope.changeVideoNumber(6);
                document.getElementById( "video_num_1" ).disabled = "true";
                document.getElementById( "video_num_2" ).disabled = "true";
                document.getElementById( "video_num_3" ).disabled = "true";
                document.getElementById( "video_num_4" ).disabled = "true";
                document.getElementById( "video_num_5" ).disabled = "true";
                document.getElementById( "video_num_6" ).disabled = "true";
                document.getElementById( "path_select_4" ).checked = true;
                $scope.changePathStrategy(4);
                document.getElementById( "path_select_0" ).disabled = "true";
                document.getElementById( "path_select_1" ).disabled = "true";
                document.getElementById( "path_select_2" ).disabled = "true";
                document.getElementById( "path_select_3" ).disabled = "true";
                document.getElementById( "path_select_4" ).disabled = "true";
                document.getElementById( "currentPathIDDisplay" ).style.display = "none";
                document.getElementById( "currentPathQualityDisplay" ).style.display = "none";
                document.getElementById( "currentLongitude" ).style.display = "block";
                document.getElementById( "currentLatitude" ).style.display = "block";
                $scope.lifeSignalEnabled = false;
                document.getElementById( "life_signal" ).disabled = "true";
                break;
        
            default:
                break;
        }
    };

    // Changing number of video paths
    $scope.changeVideoNumber = function (num) {
        $scope.streamNum.video = num;
        switch (num) {
            case 1:
                document.getElementById('videoSource_0').style = "display: block";
                document.getElementById('videoSource_1').style = "display: none";
                document.getElementById('videoSource_2').style = "display: none";
                document.getElementById('videoSource_3').style = "display: none";
                document.getElementById('videoSource_4').style = "display: none";
                document.getElementById('videoSource_5').style = "display: none";
                break;
            case 2:
                document.getElementById('videoSource_0').style = "display: block";
                document.getElementById('videoSource_1').style = "display: block";
                document.getElementById('videoSource_2').style = "display: none";
                document.getElementById('videoSource_3').style = "display: none";
                document.getElementById('videoSource_4').style = "display: none";
                document.getElementById('videoSource_5').style = "display: none";
                break;
            case 3:
                document.getElementById('videoSource_0').style = "display: block";
                document.getElementById('videoSource_1').style = "display: block";
                document.getElementById('videoSource_2').style = "display: block";
                document.getElementById('videoSource_3').style = "display: none";
                document.getElementById('videoSource_4').style = "display: none";
                document.getElementById('videoSource_5').style = "display: none";
                break;
            case 4:
                document.getElementById('videoSource_0').style = "display: block";
                document.getElementById('videoSource_1').style = "display: block";
                document.getElementById('videoSource_2').style = "display: block";
                document.getElementById('videoSource_3').style = "display: block";
                document.getElementById('videoSource_4').style = "display: none";
                document.getElementById('videoSource_5').style = "display: none";
                break;
            case 5:
                document.getElementById('videoSource_0').style = "display: block";
                document.getElementById('videoSource_1').style = "display: block";
                document.getElementById('videoSource_2').style = "display: block";
                document.getElementById('videoSource_3').style = "display: block";
                document.getElementById('videoSource_4').style = "display: block";
                document.getElementById('videoSource_5').style = "display: none";
                break;
            case 6:
                document.getElementById('videoSource_0').style = "display: block";
                document.getElementById('videoSource_1').style = "display: block";
                document.getElementById('videoSource_2').style = "display: block";
                document.getElementById('videoSource_3').style = "display: block";
                document.getElementById('videoSource_4').style = "display: block";
                document.getElementById('videoSource_5').style = "display: block";
                break;
            default:
                break;
        }
    };

    // Changing number of audio paths
    $scope.changeAudioNumber = function (num) {
        $scope.streamNum.audio = num;
        switch (num) {
            case 0:
                document.getElementById('audioSource_0').style = "display: none";
                break;
            case 1:
                document.getElementById('audioSource_0').style = "display: block";
                break;
            default:
                break;
        }
    };

    // Changing the ABR rule
    $scope.changeABRStrategy = function (strategy) {
        $scope.selectedRule = strategy;
        if ($scope.selectedRule == "globalSwitchRule") {
            document.getElementById('global-quality-video').removeAttribute("disabled");
            document.getElementById('global-quality-audio').removeAttribute("disabled");
        } else {
            document.getElementById('global-quality-video').disabled = true;
            document.getElementById('global-quality-audio').disabled = true;
        }
        if ($scope.selectedRule == "multiPathRule") {
            document.getElementById('Keep-highest-with-same-MPD').removeAttribute("disabled");
            document.getElementById('Buffer-besed-with-same-MPD').removeAttribute("disabled");
        } else {
            document.getElementById('Keep-highest-with-same-MPD').disabled = true;
            document.getElementById('Buffer-besed-with-same-MPD').disabled = true;
        }
    };

    // Changing the strategy of path switching
    $scope.changePathStrategy = function (num) {
        switch (num) {
            case 0:
                $scope.pathSwitchStrategy = 0;
                document.getElementById( "preferred-path-id" ).removeAttribute("disabled");
                document.getElementById( "preferred-sync-delay" ).disabled = "true";
                break;
            case 1:
                $scope.pathSwitchStrategy = 1;
                document.getElementById( "preferred-path-id" ).disabled = "true";
                document.getElementById( "preferred-sync-delay" ).disabled = "true";
                break;
            case 2:
                $scope.pathSwitchStrategy = 2;
                document.getElementById( "preferred-path-id" ).disabled = "true";
                document.getElementById( "preferred-sync-delay" ).disabled = "true";
                break;
            case 3:
                $scope.pathSwitchStrategy = 3;
                document.getElementById( "preferred-path-id" ).disabled = "true";
                document.getElementById( "preferred-sync-delay" ).removeAttribute("disabled");
                break;
            case 4:
                $scope.pathSwitchStrategy = 4;
                document.getElementById( "preferred-path-id" ).disabled = "true";
                document.getElementById( "preferred-sync-delay" ).disabled = "true";
                break;
            default:
                break;
        }
    };

    // Initializing & clearing the charts
    $scope.initChartingByMediaType = function (type) {
        var arr = $scope.chartState[type];
        for (var key in arr) {
            var obj = arr[key];
            $scope.pushData(key, type);
        }
    };
    $scope.pushData = function (id, type) {
        switch(type) {
            case "downloadingQuality":
                var data = {
                    id: id,
                    data: $scope.chartState[type][id].data,
                    label: $scope.chartState[type][id].label,
                    color: $scope.chartState[type][id].color,
                    type: type
                };
                $scope.chartData_downloadingQuality.push(data);
                break;
            case "playbackQuality":
                var data = {
                    id: id,
                    data: $scope.chartState[type][id].data,
                    label: $scope.chartState[type][id].label,
                    color: $scope.chartState[type][id].color,
                    type: type
                };
                $scope.chartData_playbackQuality.push(data);
                break;
            case "buffer":
                var data = {
                    id: id,
                    data: $scope.chartState[type][id].data,
                    label: $scope.chartState[type][id].label,
                    color: $scope.chartState[type][id].color,
                    type: type
                };
                $scope.chartData_buffer.push(data);
                break;
            case "throughput":
                var data = {
                    id: id,
                    data: $scope.chartState[type][id].data,
                    label: $scope.chartState[type][id].label,
                    color: $scope.chartState[type][id].color,
                    type: type
                };
                $scope.chartData_throughput.push(data);
                break;
            case "RTT":
                var data = {
                    id: id,
                    data: $scope.chartState[type][id].data,
                    label: $scope.chartState[type][id].label,
                    color: $scope.chartState[type][id].color,
                    type: type
                };
                $scope.chartData_RTT.push(data);
                break;
            case "requests":
                var data = {
                    id: id,
                    data: $scope.chartState[type][id].data,
                    label: $scope.chartState[type][id].label,
                    color: $scope.chartState[type][id].color,
                    type: type
                };
                $scope.chartData_requests.push(data);
                break;
        }
        $scope.chartOptions_downloadingQuality.legend.noColumns = Math.min($scope.chartData_downloadingQuality.length, 7);
        $scope.chartOptions_playbackQuality.legend.noColumns = Math.min($scope.chartData_playbackQuality.length, 7);
        $scope.chartOptions_buffer.legend.noColumns = Math.min($scope.chartData_buffer.length, 7);
        $scope.chartOptions_throughput.legend.noColumns = Math.min($scope.chartData_throughput.length, 7);
        $scope.chartOptions_RTT.legend.noColumns = Math.min($scope.chartData_RTT.length, 7);
        $scope.chartOptions_requests.legend.noColumns = Math.min($scope.chartData_requests.length, 7);
    };
    $scope.clearchartData = function () {
        $scope.maxDownloadingQualityBuffer = [];
        $scope.maxPlaybackQualityBuffer = [];
        $scope.maxBufferBuffer = [];
        $scope.maxThroughputBuffer = [];
        $scope.maxRTTBuffer = [];
        $scope.maxDownloadingQuality = 0;
        $scope.maxPlaybackQuality = 0;
        $scope.maxBuffer = 0;
        $scope.maxThroughput = 0;
        $scope.maxRTT = 0;
        $scope.maxRequests = 0;
        for (var key in $scope.chartState) {
            for (var i in $scope.chartState[key]) {
                $scope.chartState[key][i].data.length = 0;
            }
        }
    };

    // Plotting data in charts
    $scope.updateFigures = function () {
        let time = $scope.getTimeForPlot();
        $scope.maxDownloadingQualityBuffer.push($scope.playerDownloadingQuality.reduce((a, b) => a > b ? a : b));
        $scope.maxPlaybackQualityBuffer.push($scope.playerPlaybackQuality.reduce((a, b) => a > b ? a : b));
        $scope.maxBufferBuffer.push($scope.playerBufferLength.reduce((a, b) => a > b ? a : b));
        $scope.maxThroughputBuffer.push($scope.playerAverageThroughput.reduce((a, b) => a > b ? a : b));
        $scope.maxRTTBuffer.push($scope.playerRTT.reduce((a, b) => a > b ? a : b));
        if ($scope.maxDownloadingQualityBuffer.length > $scope.maxPointsToChart) {
            $scope.maxDownloadingQualityBuffer.shift();
        }
        if ($scope.maxPlaybackQualityBuffer.length > $scope.maxPointsToChart) {
            $scope.maxPlaybackQualityBuffer.shift();
        }
        if ($scope.maxBufferBuffer.length > $scope.maxPointsToChart) {
            $scope.maxBufferBuffer.shift();
        }
        if ($scope.maxThroughputBuffer.length > $scope.maxPointsToChart) {
            $scope.maxThroughputBuffer.shift();
        }
        if ($scope.maxRTTBuffer.length > $scope.maxPointsToChart) {
            $scope.maxRTTBuffer.shift();
        }
        $scope.maxDownloadingQuality = $scope.maxDownloadingQualityBuffer.reduce((a, b) => a > b ? a : b);
        $scope.maxPlaybackQuality = $scope.maxPlaybackQualityBuffer.reduce((a, b) => a > b ? a : b);
        $scope.maxBuffer = $scope.maxBufferBuffer.reduce((a, b) => a > b ? a : b);
        $scope.maxThroughput = $scope.maxThroughputBuffer.reduce((a, b) => a > b ? a : b);
        $scope.maxRTT = $scope.maxRTTBuffer.reduce((a, b) => a > b ? a : b);
        $scope.chartOptions_downloadingQuality.yaxis.max = $scope.maxDownloadingQuality;
        $scope.chartOptions_playbackQuality.yaxis.max = $scope.maxPlaybackQuality;
        $scope.chartOptions_buffer.yaxis.max = $scope.maxBuffer;
        $scope.chartOptions_throughput.yaxis.max = $scope.maxThroughput / 1000;
        $scope.chartOptions_RTT.yaxis.max = $scope.maxRTT;
        for (let i = 0; i <= $scope.playerNum; i++) {
            if ($scope.players[i] && $scope.startupTime != 0) {
                $scope.plotPoint(i == $scope.playerNum ? "audio" : "video_" + i, 'downloadingQuality', $scope.playerDownloadingQuality[i], time);
                $scope.plotPoint(i == $scope.playerNum ? "audio" : "video_" + i, 'playbackQuality', $scope.playerPlaybackQuality[i], time);
                $scope.plotPoint(i == $scope.playerNum ? "audio" : "video_" + i, 'buffer', $scope.playerBufferLength[i], time);
                $scope.plotPoint(i == $scope.playerNum ? "audio" : "video_" + i, 'throughput', $scope.playerAverageThroughput[i] / 1000, time);
                $scope.plotPoint(i == $scope.playerNum ? "audio" : "video_" + i, 'RTT', $scope.playerRTT[i], time);
            }
        }
    };
    $scope.updateRequestsFigures = function () {
        if ($scope.requestList.length > $scope.requestListLength) {
            // $scope.maxRequests = $scope.requestList.reduce((a, b) => a.request._quality > b ? a.request._quality : b);
            // $scope.chartOptions_requests.yaxis.max = $scope.maxRequests;
            $scope.plotPoint($scope.requestList[$scope.requestListLength].count == $scope.playerNum ? "audio" : "video_" + $scope.requestList[$scope.requestListLength].count, 'requests', $scope.requestList[$scope.requestListLength].request._quality, $scope.requestList[$scope.requestListLength].request.mediaStartTime);
            $scope.requestListLength++;
        } else if ($scope.requestList.length < $scope.requestListLength) {
            console.log("RequestList figures wrong!")
        }
    };
    $scope.getTimeForPlot = function () {
        let now = new Date().getTime() / 1000  + $scope.clientServerTimeShift;
        return Math.max(now - $scope.startupTime, 0);
    };
    $scope.plotPoint = function (name, type, value, time) {
        var specificChart = $scope.chartState[type];
        if (specificChart) {
            var data = specificChart[name].data;
            data.push([time, value]);
            if (data.length > $scope.maxPointsToChart) {
                data.splice(0, 1);
            }
        }
    };


    //// Functions: media players

/////////////////////////////////////////////////////////////////////////////////////
    // Loading streams
    $scope.loadStream = function() {
        // ABR strategies, number of video and audio paths, scheduling timeout cannot change after initialization
        document.getElementById( "MultiPathMode" ).disabled = "true";
        document.getElementById( "VRMode" ).disabled = "true";
        // document.getElementById( "DefaultRule" ).disabled = "true";
        // document.getElementById( "MyThroughputRule" ).disabled = "true";
        // document.getElementById( "MultiPathRule" ).disabled = "true";
        // document.getElementById( "HighestBitrateRule" ).disabled = "true";
        // document.getElementById( "LowestBitrateRule" ).disabled = "true";
        // document.getElementById( "GlobalSwitchRule" ).disabled = "true";
        // document.getElementById( "life_signal" ).disabled = "true";
        document.getElementById( "video_num_1" ).disabled = "true";
        document.getElementById( "video_num_2" ).disabled = "true";
        document.getElementById( "video_num_3" ).disabled = "true";
        document.getElementById( "video_num_4" ).disabled = "true";
        document.getElementById( "video_num_5" ).disabled = "true";
        document.getElementById( "video_num_6" ).disabled = "true";
        document.getElementById( "audio_num_0" ).disabled = "true";
        document.getElementById( "audio_num_1" ).disabled = "true";
        // document.getElementById( "schedule-interval" ).disabled = "true";
        switch ($scope.selectedMode) {
            case 'Multi-Path':
                $scope.mse_init();
                break;
            case 'VR':
                $scope.aframe_init();
                break;
            default:
                break;
        }
    };

    // Initializing streams with MediaSource
    $scope.mse_init = function() {

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

        // Attach view & source
        $scope.streamElement = document.getElementById('video');
        if (!$scope.streamElement) {
            window.alert("There is no video element in window!");
            return;
        }
        $scope.mediaSource = new MediaSource();
        if (!$scope.mediaSource) {
            window.alert("There is no MediaSource object generated!");
            return;
        }
        $scope.streamElement.src = URL.createObjectURL($scope.mediaSource);

        // Load MPDs
        $scope.mediaSource.addEventListener('sourceopen', $scope.sourceOpen);

    };

    // Checking paths of videos/audios
    $scope.checkPaths = function() {

        if (!($scope.streamNum.video || $scope.streamNum.audio)) {
            window.alert("Wrong streamNum.video/streamNum.audio: At least one path for fetching media!");
            return false;
        }

        for (let i = 0; i < $scope.streamNum.video; i++) {
            if (!$scope.videoURLs[i] || $scope.videoURLs[i] == "") {
                window.alert("Wrong videoURLs[" + i + "]: Empty URL in a path of video!");
                return false;
            }
            if (!$scope.videoURLs[i] || $scope.videoURLs[i].slice(-4) !== ".mpd") {
                window.alert("Wrong videoURLs[" + i + "]: Not a .mpd URL in a path of video!");
                return false;
            }
        }

        for (let i = 0; i < $scope.streamNum.audio; i++) {
            if (!$scope.audioURLs[i] || $scope.audioURLs[i] == "") {
                window.alert("Wrong audioURLs[" + i + "]: Empty URL in a path of audio!");
                return false;
            }
            if (!$scope.audioURLs[i] || $scope.audioURLs[i].slice(-4) !== ".mpd") {
                window.alert("Wrong audioURLs[" + i + "]: Not a .mpd URL in a path of audio!");
                return false;
            }
        }

        return true;

    };

    // Triggered when mediaSoure is ready to open sources
    $scope.sourceOpen = function() {

        for (let i = 0; i < $scope.streamNum.video; i++) {
            $scope.fetchMpd($scope.videoURLs[i], (response) => {
                $scope.loadMpd(response, "video", i);
            });
        }

        for (let i = 0; i < $scope.streamNum.audio; i++) {
            $scope.fetchMpd($scope.audioURLs[i], (response) => {
                $scope.loadMpd(response, "audio", i);
            });
        }

        if (!$scope.streamSourceBuffer) {
            window.alert("All sources are unavaliable, please reload!")
        }

    };

    // Fetch MPDs by a request
    $scope.fetchMpd = function(url, callback) {

        if (url == "") {
            window.alert("Empty URL when fetching MPD!");
            return;
        }
        $scope.fetchBuffer($scope.resolveUrl($scope.TYPE_OF_MPD, url), $scope.RESPONSE_TYPE_OF_MPD, callback);

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

        var baseUrl = contentType == "video" ? $scope.resolveUrl($scope.TYPE_OF_MPD, $scope.videoURLs[i]) : contentType == "audio" ? $scope.resolveUrl($scope.TYPE_OF_MPD, $scope.audioURLs[i]) : NaN;
        manifest.baseUrl = baseUrl ? baseUrl.slice(0, baseUrl.lastIndexOf("/") + 1) : NaN;
        if (!manifest.baseUrl || manifest.baseUrl == "") {
            window.alert("Wrong manifest of " + contentType + "URLs[" + i + "]: No base URL available in the manifest!");
            return;
        }

        $scope.streamMpds[contentType][i] = manifest;
        console.log("StreamMpds." + contentType + "[" + i + "] is loaded!");
        $scope.register($scope.streamMpds[contentType][i], contentType, i);

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

    // Executed when MPDs are loaded
    $scope.register = function(manifest, contentType, i) {  //////////////////////////////

        try {
            // Check if the duration is equal
            if (!manifest.mediaPresentationDuration || ($scope.streamDuration && manifest.mediaPresentationDuration != $scope.streamDuration)) {
                throw "Unequal duration!";
            }

            // Check if the type is the same
            if (!manifest.type || ($scope.streamIsDynamic && (manifest.type == "dynamic") != $scope.streamIsDynamic)) {
                throw "Different type of manifest!";
            }

            // Register bitrate lists
            let registerBitrateListsResult = $scope.registerBitrateLists(manifest, contentType, i);
            if (registerBitrateListsResult != "SUCCESS") {
                throw registerBitrateListsResult;
            }

            // Register stream information and create SourceBuffer
            if (!$scope.streamSourceBuffer[contentType]) {
                // Register stream information
                let registerStreamInfoResult = $scope.registerFirstStreamInfo(manifest, contentType, i);
                if (registerStreamInfoResult != "SUCCESS") {
                    throw registerStreamInfoResult;
                }
                // Fetch the first init segment and the first media segment
                $scope.fetchSegment(contentType, $scope.TYPE_OF_INIT_SEGMENT);
                setInterval($scope.scheduleFetcher.bind(this, contentType), $scope.scheduleInterval);
            }

            // Create and initialize control bar
            if (!$scope.controllBar) {
                $scope.controllBar = new ControlBar();
                $scope.controllBar.initialize();
                $scope.controllBar.destroyAllMenus();
            }
            // Create and add track/bitrate/caption lists into control bar
            $scope.controllBar.onStreamActivated(contentType, i);
            // Add eventListeners of control bar
            $scope.streamElement.addEventListener($scope.EVENT_TIME_UPDATE, $scope.controllBar.onPlaybackTimeUpdate);
        } catch (e) {
            window.alert("Error when registerring " + contentType + " " + i + (e == "" ? e : ": " + e));
        }
    
    };

    // Fetch the segments periodly if isFetchingSegment is false
    $scope.scheduleFetcher = function(contentType) {
        var bufferLevel = $scope.getBufferLevel(contentType);
        if (!$scope.isSeeking && !$scope.isFetchingSegment[contentType] && !isNaN(bufferLevel) && bufferLevel < $scope.targetBuffer) {
            if ($scope.autoSwitchBitrate[contentType] && $scope.autoSwitchTrack[contentType] && $scope.abrRules.hasOwnProperty($scope.selectedRule)) {
                $scope.streamInfo[contentType] = $scope.abrRules[$scope.selectedRule].setStreamInfo($scope.streamInfo[contentType], contentType);
            }
            if ($scope.initCache[contentType][$scope.streamInfo[contentType].pathIndex][$scope.streamInfo[contentType].periodIndex][$scope.streamInfo[contentType].adaptationSetIndex][$scope.streamInfo[contentType].representationIndex]) {
                if (!isNaN($scope.streamBitrateLists[contentType][$scope.streamInfo[contentType].pathIndex][$scope.streamInfo[contentType].periodIndex][$scope.streamInfo[contentType].adaptationSetIndex][$scope.streamInfo[contentType].representationIndex].segmentNum) && $scope.streamInfo[contentType].segmentIndex <= $scope.streamBitrateLists[contentType][$scope.streamInfo[contentType].pathIndex][$scope.streamInfo[contentType].periodIndex][$scope.streamInfo[contentType].adaptationSetIndex][$scope.streamInfo[contentType].representationIndex].segmentNum) {
                    $scope.fetchSegment(contentType, $scope.TYPE_OF_MEDIA_SEGMENT);
                }
            } else {
                $scope.fetchSegment(contentType, $scope.TYPE_OF_INIT_SEGMENT);
            }
        }
    };

    // Get the buffer level of videos/audios
    $scope.getBufferLevel = function(contentType) {
        var elementBuffered = $scope.streamSourceBuffer[contentType].buffered;
        if (elementBuffered.length == 0) {
            return 0;
        }
        for (let i = 0; i < elementBuffered.length; i++) {
            if (elementBuffered.start(i) <= $scope.streamElement.currentTime && elementBuffered.end(i) >= $scope.streamElement.currentTime) {
                return elementBuffered.end(i) - $scope.streamElement.currentTime;
            }
        }
        return 0;
    };

    // Register bitrate lists
    $scope.registerBitrateLists = function(manifest, contentType, i) {
        
        try {
            $scope.streamBitrateLists[contentType][i] = [];
            $scope.initCache[contentType][i] = [];
            if (!manifest.Period || manifest.Period.length == 0) {
                throw "No period is available in path " + i + "!";
            }
            for (let j = 0; j < manifest.Period.length; j++) {
                $scope.streamBitrateLists[contentType][i][j] = [];
                $scope.initCache[contentType][i][j] = [];
                if (!manifest.Period[j].AdaptationSet || manifest.Period[j].AdaptationSet.length == 0) {
                    throw "No adaptation set is available in path " + i + ", period " + j + "!";
                }
                for (let jj = 0; jj < manifest.Period[j].AdaptationSet.length; jj++) {
                    if (manifest.Period[j].AdaptationSet[jj].contentType == contentType) {
                        $scope.streamBitrateLists[contentType][i][j][jj] = [];
                        $scope.initCache[contentType][i][j][jj] = [];
                        if (!manifest.Period[j].AdaptationSet[jj].Representation || manifest.Period[j].AdaptationSet[jj].Representation.length == 0) {
                            throw "No representation is available in path " + i + ", period " + j + ", adaptation set " + jj + "!";
                        }
                        for (let jjj = 0; jjj < manifest.Period[j].AdaptationSet[jj].Representation.length; jjj++) {
                            let mimeFromMpd = manifest.Period[j].AdaptationSet[jj].Representation[jjj].mimeType;
                            let codecsFromMpd = manifest.Period[j].AdaptationSet[jj].Representation[jjj].codecs;
                            if (mimeFromMpd && codecsFromMpd) {
                                let mimeCodecsFromMpd = mimeFromMpd + ";codecs=\"" + codecsFromMpd + "\"";
                                if ('MediaSource' in window && MediaSource.isTypeSupported(mimeCodecsFromMpd)) {
                                    $scope.streamBitrateLists[contentType][i][j][jj][jjj] = {
                                        id: !isNaN(manifest.Period[j].AdaptationSet[jj].Representation[jjj].id) ? manifest.Period[j].AdaptationSet[jj].Representation[jjj].id : NaN,
                                        mimeCodecs: mimeCodecsFromMpd,
                                        bandwidth: manifest.Period[j].AdaptationSet[jj].Representation[jjj].bandwidth ? manifest.Period[j].AdaptationSet[jj].Representation[jjj].bandwidth : NaN,
                                        duration: manifest.Period[j].AdaptationSet[jj].Representation[jjj].SegmentTemplate ? manifest.Period[j].AdaptationSet[jj].Representation[jjj].SegmentTemplate[0].duration ? manifest.Period[j].AdaptationSet[jj].Representation[jjj].SegmentTemplate[0].duration / 1000000 : NaN : manifest.Period[j].AdaptationSet[jj].Representation[jjj].duration ? manifest.Period[j].AdaptationSet[jj].Representation[jjj].duration / 1000000 : NaN,
                                        initialization: manifest.Period[j].AdaptationSet[jj].Representation[jjj].SegmentTemplate ? manifest.Period[j].AdaptationSet[jj].Representation[jjj].SegmentTemplate[0].initialization ? manifest.Period[j].AdaptationSet[jj].Representation[jjj].SegmentTemplate[0].initialization : NaN : manifest.Period[j].AdaptationSet[jj].Representation[jjj].initialization ? manifest.Period[j].AdaptationSet[jj].Representation[jjj].initialization : NaN,
                                        media: manifest.Period[j].AdaptationSet[jj].Representation[jjj].SegmentTemplate ? manifest.Period[j].AdaptationSet[jj].Representation[jjj].SegmentTemplate[0].media ? manifest.Period[j].AdaptationSet[jj].Representation[jjj].SegmentTemplate[0].media : NaN : manifest.Period[j].AdaptationSet[jj].Representation[jjj].media ? manifest.Period[j].AdaptationSet[jj].Representation[jjj].media : NaN,
                                        startNumber: manifest.Period[j].AdaptationSet[jj].Representation[jjj].SegmentTemplate ? !isNaN(manifest.Period[j].AdaptationSet[jj].Representation[jjj].SegmentTemplate[0].startNumber) ? manifest.Period[j].AdaptationSet[jj].Representation[jjj].SegmentTemplate[0].startNumber : NaN : !isNaN(manifest.Period[j].AdaptationSet[jj].Representation[jjj].startNumber) ? manifest.Period[j].AdaptationSet[jj].Representation[jjj].startNumber : NaN,
                                        width: !isNaN(manifest.Period[j].AdaptationSet[jj].Representation[jjj].width) ? manifest.Period[j].AdaptationSet[jj].Representation[jjj].width : NaN,
                                        height: !isNaN(manifest.Period[j].AdaptationSet[jj].Representation[jjj].height) ? manifest.Period[j].AdaptationSet[jj].Representation[jjj].height : NaN,
                                        segmentNum: NaN
                                    };
                                    if ($scope.streamBitrateLists[contentType][i][j][jj][jjj].duration) {
                                        if (manifest.Period[j].duration) {
                                            $scope.streamBitrateLists[contentType][i][j][jj][jjj].segmentNum = Math.ceil(manifest.Period[j].duration / $scope.streamBitrateLists[contentType][i][j][jj][jjj].duration);
                                        } else if (manifest.Period[j].start != undefined) {
                                            let temp = manifest.mediaPresentationDuration;
                                            for (let k = 0; k < manifest.Period.length; k++) {
                                                if (manifest.Period[k].start > manifest.Period[j].start && manifest.Period[k].start < temp) {
                                                    temp = manifest.Period[k].start;
                                                }
                                            }
                                            $scope.streamBitrateLists[contentType][i][j][jj][jjj].segmentNum = Math.ceil((temp - manifest.Period[j].start) / $scope.streamBitrateLists[contentType][i][j][jj][jjj].duration);
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
            return "registerBitrateLists: " + e;
        }

    };

    // Register stream information
    $scope.registerFirstStreamInfo = function(manifest, contentType, i) {

        try {
            // Extract the current streamInfo
            var tempStreamInfo = {};
            // baseUrl
            if (!manifest.baseUrl) {
                throw "No base URL in the MPD of path " + i + "!";
            }
            tempStreamInfo.baseUrl = manifest.baseUrl;
            // pathIndex
            tempStreamInfo.pathIndex = i;
            // periodIndex
            if (!manifest.Period || manifest.Period.length == 0) {
                throw "No period is available in path " + i + "!";
            }
            for (let j = 0; j < manifest.Period.length; j++) {
                if ((manifest.Period[j].start != undefined && manifest.Period[j].start == 0) || (manifest.Period[j].start == undefined && manifest.Period[j].id != undefined && manifest.Period[j].id == 0) || (manifest.Period[j].start == undefined && manifest.Period[j].id == undefined)) {
                    tempStreamInfo.periodIndex = j;
                    // adaptationSetIndex
                    if (!manifest.Period[j].AdaptationSet || manifest.Period[j].AdaptationSet.length == 0) {
                        throw "No adaptation set is available in path " + i + ", period " + j + "!";
                    }
                    for (let jj = 0; jj < manifest.Period[j].AdaptationSet.length; jj++) {
                        if (manifest.Period[j].AdaptationSet[jj].contentType == contentType && manifest.Period[j].AdaptationSet[jj].Representation != undefined) {
                            tempStreamInfo.adaptationSetIndex = jj;
                            // representationIndex
                            let firstsmall, secondsmall;
                            for (let jjj = 0; jjj < manifest.Period[j].AdaptationSet[jj].Representation.length; jjj++) {
                                if ($scope.streamBitrateLists[contentType] && $scope.streamBitrateLists[contentType][i] && $scope.streamBitrateLists[contentType][i][j] && $scope.streamBitrateLists[contentType][i][j][jj] && $scope.streamBitrateLists[contentType][i][j][jj][jjj] && $scope.streamBitrateLists[contentType][i][j][jj][jjj].bandwidth) {
                                    if (!firstsmall) {
                                        firstsmall = { key: jjj, value: $scope.streamBitrateLists[contentType][i][j][jj][jjj].bandwidth };
                                    } else if (firstsmall && !secondsmall) {
                                        if ($scope.streamBitrateLists[contentType][i][j][jj][jjj].bandwidth < firstsmall.value) {
                                            secondsmall = firstsmall;
                                            firstsmall = { key: jjj, value: $scope.streamBitrateLists[contentType][i][j][jj][jjj].bandwidth };
                                        } else {
                                            secondsmall = { key: jjj, value: $scope.streamBitrateLists[contentType][i][j][jj][jjj].bandwidth };
                                        }
                                    } else if (!firstsmall && secondsmall) {
                                        throw "Error when selecting representation";
                                    } else {
                                        if ($scope.streamBitrateLists[contentType][i][j][jj][jjj].bandwidth < firstsmall.value) {
                                            secondsmall = firstsmall;
                                            firstsmall = { key: jjj, value: $scope.streamBitrateLists[contentType][i][j][jj][jjj].bandwidth };
                                        } else if ($scope.streamBitrateLists[contentType][i][j][jj][jjj].bandwidth < secondsmall) {
                                            secondsmall = { key: jjj, value: $scope.streamBitrateLists[contentType][i][j][jj][jjj].bandwidth };
                                        }
                                    }
                                }
                            }
                            if ($scope.lifeSignalEnabled && secondsmall) {
                                if (!isNaN($scope.streamBitrateLists[contentType][i][j][jj][secondsmall.key].startNumber) && $scope.streamBitrateLists[contentType][i][j][jj][secondsmall.key].mimeCodecs && $scope.streamBitrateLists[contentType][i][j][jj][firstsmall.key].duration) {
                                    tempStreamInfo.representationIndex = secondsmall.key;
                                    // segmentIndex
                                    tempStreamInfo.segmentIndex = $scope.streamBitrateLists[contentType][i][j][jj][secondsmall.key].startNumber;
                                    // mimeCodecs
                                    tempStreamInfo.mimeCodecs = $scope.streamBitrateLists[contentType][i][j][jj][secondsmall.key].mimeCodecs;
                                    // duration
                                    tempStreamInfo.duration = $scope.streamBitrateLists[contentType][i][j][jj][firstsmall.key].duration;
                                    break;
                                }
                            } else if (firstsmall) {
                                if (!isNaN($scope.streamBitrateLists[contentType][i][j][jj][firstsmall.key].startNumber) && $scope.streamBitrateLists[contentType][i][j][jj][firstsmall.key].mimeCodecs && $scope.streamBitrateLists[contentType][i][j][jj][firstsmall.key].duration) {
                                    tempStreamInfo.representationIndex = firstsmall.key;
                                    // segmentIndex
                                    tempStreamInfo.segmentIndex = $scope.streamBitrateLists[contentType][i][j][jj][firstsmall.key].startNumber;
                                    // mimeCodecs
                                    tempStreamInfo.mimeCodecs = $scope.streamBitrateLists[contentType][i][j][jj][firstsmall.key].mimeCodecs;
                                    // duration
                                    tempStreamInfo.duration = $scope.streamBitrateLists[contentType][i][j][jj][firstsmall.key].duration;
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

            // Create SourceBuffer and initialize settings and parameters
            if ($scope.streamSourceBuffer[contentType]) {
                throw "The registeration of path " + i + " is aborted by the existing SourceBuffer!";
            }
            if (!$scope.streamDuration) {
                $scope.streamDuration = manifest.mediaPresentationDuration;
            }
            if (!$scope.streamIsDynamic) {
                $scope.streamIsDynamic = manifest.type == "static" ? false : manifest.type == "dynamic" ? true : false;
            }
            $scope.autoSwitchTrack[contentType] = true;  // Use path switching as default
            $scope.autoSwitchBitrate[contentType] = true;  // Use ABR rules as default
            $scope.isFetchingSegment[contentType] = false;
            $scope.isSeeking = false;
            $scope.streamInfo[contentType] = tempStreamInfo;
            $scope.streamInfo[contentType].mimeCodecs = $scope.streamBitrateLists[contentType][i][$scope.streamInfo[contentType].periodIndex][$scope.streamInfo[contentType].adaptationSetIndex][$scope.streamInfo[contentType].representationIndex].mimeCodecs;
            try {
                $scope.streamSourceBuffer[contentType] = $scope.mediaSource.addSourceBuffer($scope.streamInfo[contentType].mimeCodecs);
            } catch (e) {
                throw "SourceBuffer is not initialized: " + e;
            }
            $scope.streamSourceBuffer[contentType].addEventListener($scope.EVENT_UPDATE_END, $scope.appendBufferFromListener(contentType));
            $scope.streamSourceBuffer[contentType].addEventListener($scope.EVENT_UPDATE_END, () => {
                if ($scope.controllBar && $scope.controllBar.onBufferLevelUpdated) {
                    $scope.controllBar.onBufferLevelUpdated();
                }
            });
            setInterval($scope.appendBufferFromInterval, $scope.INTERVAL_OF_APPEND_BUFFER_FROM_INTERVAL);
            $scope.mediaSource.duration = $scope.streamDuration;

            return "SUCCESS";
        } catch (e) {
            return "registerFirstStreamInfo: " + e;
        }

    };

    // Run when the segment need to be fetched from servers
    $scope.fetchSegment = function(contentType, urlType) {

        var curStreamInfo = {
            pathIndex: $scope.streamInfo[contentType].pathIndex,
            periodIndex: $scope.streamInfo[contentType].periodIndex,
            adaptationSetIndex: $scope.streamInfo[contentType].adaptationSetIndex,
            representationIndex: $scope.streamInfo[contentType].representationIndex,
            segmentIndex: $scope.streamInfo[contentType].segmentIndex,
            baseUrl: $scope.streamInfo[contentType].baseUrl,
            mimeCodecs: $scope.streamInfo[contentType].mimeCodecs
        };
        if (urlType == $scope.TYPE_OF_INIT_SEGMENT && $scope.initCache[contentType][curStreamInfo.pathIndex][curStreamInfo.periodIndex][curStreamInfo.adaptationSetIndex][curStreamInfo.representationIndex]) {
            console.log("Init segment of " + contentType + " " + curStreamInfo.pathIndex + " period " + curStreamInfo.periodIndex + " adaptationSet " + curStreamInfo.adaptationSetIndex + " representation " + curStreamInfo.representationIndex + " is in the initCache!");
            // $scope.streamBufferToAppend[contentType].push($scope.initCache[contentType][curStreamInfo.pathIndex][curStreamInfo.periodIndex][curStreamInfo.adaptationSetIndex][curStreamInfo.representationIndex]);
            return;
        }
        var paramForResolveUrl = {
            id: $scope.streamBitrateLists[contentType][curStreamInfo.pathIndex][curStreamInfo.periodIndex][curStreamInfo.adaptationSetIndex][curStreamInfo.representationIndex].id,
            segmentIndex: curStreamInfo.segmentIndex
        };
        var url = curStreamInfo.baseUrl;
        var urlExtend = urlType == $scope.TYPE_OF_INIT_SEGMENT ? $scope.streamBitrateLists[contentType][curStreamInfo.pathIndex][curStreamInfo.periodIndex][curStreamInfo.adaptationSetIndex][curStreamInfo.representationIndex].initialization : urlType == $scope.TYPE_OF_MEDIA_SEGMENT ? $scope.streamBitrateLists[contentType][curStreamInfo.pathIndex][curStreamInfo.periodIndex][curStreamInfo.adaptationSetIndex][curStreamInfo.representationIndex].media : "";
        var urlResolved = $scope.resolveUrl(urlType, url, urlExtend, paramForResolveUrl);
        $scope.isFetchingSegment[contentType] = true;
        $scope.fetchBuffer(urlResolved, $scope.RESPONSE_TYPE_OF_SEGMENT, 
            (buffer) => {
                $scope.loadSegment(buffer, contentType, curStreamInfo, urlType);
                $scope.isFetchingSegment[contentType] = false;
            },
            (status) => {
                if (status == 404) {
                    console.log("No file: " + urlResolved);
                    $scope.isFetchingSegment[contentType] = false;
                    $scope.streamInfo[contentType].segmentIndex = $scope.streamInfo[contentType].lastSegmentIndex;
                }
            }
        );

    };

    // Load segments from responses and append to queue
    $scope.loadSegment = function(buffer, contentType, curStreamInfo, urlType) {

        $scope.streamBufferToAppend[contentType].push(buffer);
        if (urlType == $scope.TYPE_OF_INIT_SEGMENT) {  // Save in the cache if InitSegment
            $scope.initCache[contentType][curStreamInfo.pathIndex][curStreamInfo.periodIndex][curStreamInfo.adaptationSetIndex][curStreamInfo.representationIndex] = buffer;
        } else if (urlType == $scope.TYPE_OF_MEDIA_SEGMENT) {    // Add buffered time if MediaSegment
            $scope.streamInfo[contentType].lastSegmentIndex = $scope.streamInfo[contentType].segmentIndex;
            $scope.streamInfo[contentType].segmentIndex++;
            // Judge if continue, jump into the next period or end the stream
            if ($scope.streamInfo[contentType].segmentIndex > $scope.streamBitrateLists[contentType][$scope.streamInfo[contentType].pathIndex][$scope.streamInfo[contentType].periodIndex][$scope.streamInfo[contentType].adaptationSetIndex][$scope.streamInfo[contentType].representationIndex].segmentNum + $scope.streamBitrateLists[contentType][$scope.streamInfo[contentType].pathIndex][$scope.streamInfo[contentType].periodIndex][$scope.streamInfo[contentType].adaptationSetIndex][$scope.streamInfo[contentType].representationIndex].startNumber - 1) {
                let curPeriodIndex = $scope.streamInfo[contentType].periodIndex;
                let temp = {
                    value: $scope.streamMpds[contentType][$scope.streamInfo[contentType].pathIndex].mediaPresentationDuration,
                    index: -1
                };
                for (let i = 0; i < $scope.streamMpds[contentType][$scope.streamInfo[contentType].pathIndex].Period.length; i++) {
                    if ($scope.streamMpds[contentType][$scope.streamInfo[contentType].pathIndex].Period[i].start != undefined && $scope.streamMpds[contentType][$scope.streamInfo[contentType].pathIndex].Period[i].start > $scope.streamMpds[contentType][$scope.streamInfo[contentType].pathIndex].Period[curPeriodIndex].start && $scope.streamMpds[contentType][$scope.streamInfo[contentType].pathIndex].Period[i].start < temp.value) {
                        temp.value = $scope.streamMpds[contentType][$scope.streamInfo[contentType].pathIndex].Period[i].start;
                        temp.index = i;
                    } else if ($scope.streamMpds[contentType][$scope.streamInfo[contentType].pathIndex].Period[i].id != undefined && $scope.streamMpds[contentType][$scope.streamInfo[contentType].pathIndex].Period[i].id == $scope.streamMpds[contentType][$scope.streamInfo[contentType].pathIndex].Period[curPeriodIndex].id + 1) {
                        temp.index = i;
                    }
                }
                if (temp.index != -1) {
                    $scope.streamInfo[contentType].periodIndex = temp.index;
                    $scope.streamInfo[contentType].segmentIndex = $scope.streamBitrateLists[contentType][$scope.streamInfo[contentType].pathIndex][$scope.streamInfo[contentType].periodIndex][$scope.streamInfo[contentType].adaptationSetIndex][$scope.streamInfo[contentType].representationIndex].startNumber;
                }
            }
        }
        $scope.scheduleFetcher(contentType);
    }

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
                    if (tempUrlExtend.indexOf($scope.TAG_OF_REPRESENTATION_ID) == -1) {
                        throw "Wrong placeholder of representation ID!";
                    }
                    tempUrlExtend = tempUrlExtend.replace($scope.TAG_OF_REPRESENTATION_ID, paramForResolveUrl.id);  // Replace representation ID in the URL
                    return url + tempUrlExtend;
                } catch (e) {
                    window.alert("Error when resolving URL of InitSegment: " + e);
                    return "";
                }
            case $scope.TYPE_OF_MEDIA_SEGMENT:
                try {
                    let numberMatcher = function (num, lenstr) {
                        if (lenstr.indexOf("%") == -1) {
                            return num.toString();
                        }
                        let len = parseInt(lenstr.slice(lenstr.indexOf("%") + 1, lenstr.indexOf("%") + 3));
                        let result = num.toString();
                        while (result.length < len) {
                            result = "0" + result;
                        }
                        return result;
                    };

                    if (url == "") {
                        throw "No base URL!";
                    }
                    let tempUrlExtend = urlExtend;
                    if (tempUrlExtend.indexOf($scope.TAG_OF_REPRESENTATION_ID) == -1) {
                        throw "Wrong placeholder of representation ID!";
                    }
                    tempUrlExtend = tempUrlExtend.replace($scope.TAG_OF_REPRESENTATION_ID, paramForResolveUrl.id);  // Replace representation ID in the URL
                    $scope.TAG_OF_SEGMENT_INDEX = tempUrlExtend.slice(tempUrlExtend.indexOf("$Number"), tempUrlExtend.lastIndexOf("$") + 1);
                    if (tempUrlExtend.indexOf($scope.TAG_OF_SEGMENT_INDEX) == -1) { /////////////////////////
                        throw "Wrong placeholder of segment number!";
                    }
                    tempUrlExtend = tempUrlExtend.replace($scope.TAG_OF_SEGMENT_INDEX, numberMatcher(paramForResolveUrl.segmentIndex, $scope.TAG_OF_SEGMENT_INDEX));  // Replace segment number in the URL
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

    // Triggered when updateend event happens
    $scope.appendBufferFromListener = function(contentType) {
        if ($scope.streamSourceBuffer[contentType].updating) {
            return;
        }
        if ($scope.streamBufferToAppend[contentType].length > 0) {
            let buffer = $scope.streamBufferToAppend[contentType].shift();
            $scope.streamSourceBuffer[contentType].appendBuffer(buffer);
        }
    }

    // Periodly check and append buffers
    $scope.appendBufferFromInterval = function() {
        if ($scope.streamSourceBuffer['video'] && !$scope.streamSourceBuffer['video'].updating && $scope.streamBufferToAppend['video'].length > 0) {
            let buffer = $scope.streamBufferToAppend['video'].shift();
            $scope.streamSourceBuffer['video'].appendBuffer(buffer);
        }
        if ($scope.streamSourceBuffer['audio'] && !$scope.streamSourceBuffer['audio'].updating && $scope.streamBufferToAppend['audio'].length > 0) {
            let buffer = $scope.streamBufferToAppend['audio'].shift();
            $scope.streamSourceBuffer['audio'].appendBuffer(buffer);
        }
    }

    // Create and load a XMLHttpRequest
    $scope.fetchBuffer = function(url, responseType, callback, noFile) {

        if (!url) {
            window.alert("The URL is invalid: " + url);
            return;
        }
        var xhr = new XMLHttpRequest();
        xhr.open($scope.HTTP_REQUEST_METHOD, url);
        xhr.responseType = responseType;  // 'text', 'arraybuffer'
        xhr.onload = function () {
            if (xhr.status == 200) {
                callback(xhr.response);
            }
        };
        xhr.onreadystatechange = function () {
            if (noFile && xhr.status == 404) {
                noFile(xhr.status);
                xhr.onreadystatechange = null;
            }
        }
        xhr.send();

    };
/////////////////////////////////////////////////////////////////////////////////////

    // Initializing the aframe page
    $scope.aframe_init = function() {
        document.getElementById( 'frame' ).src = "./6_1_1.html";
        $scope.lon = 0;
        $scope.lat = 0;
    };

    // Enabling the FOV event listener in iframe, and start initialization
    document.getElementById('frame').onload = function () {
        // $scope.initial();
    };

    // Triggered when the playback quality has changed
    $scope.quality_change_rendered = function(e) {
        // Calculate playbackQuality for each path by API
        if ($scope.playerPlaybackQuality != undefined && $scope.playerPlaybackQuality[e.count] != undefined) {
            $scope.playerPlaybackQuality[e.count] = e.newQuality;
        }
    };

    // Reloading streams
    $scope.reloadStream = function() {
        $scope.clearchartData();
        $scope.forcedPause = false;
        $scope.requestList = [];
        $scope.requestListLength = 0;
        $scope.playerTotalBitrateList = [];
        $scope.multiPathQuality = [0, 0, 0, 0, 0, 0];
        $scope.previousmultiPathQuality = [0, 0, 0, 0, 0, 0];
        $scope.changeQualityFlag = [0, 0, 0, 0, 0, 0];
        for (let i = 0; i < $scope.playerNum; i++) {
            if ($scope.players[i] && $scope.videoURLs[i]) {
                $scope.buffer_empty_flag[i] = true;
                $scope.playerBufferLength[i] = 0;
                $scope.playerAverageThroughput[i] = 0;
                $scope.playerTime[i] = 0;
                $scope.loadedTime[i] = 0;
                $scope.playerDownloadingQuality[i] = 0;
                $scope.playerPlaybackQuality[i] = 0;
                $scope.playerPastDownloadingQuality[i] = 0;
                $scope.playerCatchUp[i] = 0;
                $scope.playerRTT[i] = Infinity;
                $scope.playerBitrateList[i] = [];
                $scope.playerLastBitrateList[i] = [];
                $scope.players[i].attachSource($scope.videoURLs[i]);
            }
        }
        if ($scope.players[$scope.playerNum] && $scope.audioURLs[0]) {
            $scope.buffer_empty_flag[$scope.playerNum] = true;
            $scope.playerBufferLength[$scope.playerNum] = 0;
            $scope.playerAverageThroughput[$scope.playerNum] = 0;
            $scope.playerTime[$scope.playerNum] = 0;
            $scope.loadedTime[$scope.playerNum] = 0;
            $scope.playerDownloadingQuality[$scope.playerNum] = 0;
            $scope.playerPlaybackQuality[$scope.playerNum] = 0;
            $scope.playerPastDownloadingQuality[$scope.playerNum] = 0;
            $scope.playerCatchUp[$scope.playerNum] = 0;
            $scope.playerRTT[$scope.playerNum] = Infinity;
            $scope.playerBitrateList[$scope.playerNum] = [];
            $scope.playerLastBitrateList[$scope.playerNum] = [];
            $scope.players[$scope.playerNum].attachSource($scope.audioURLs[0]);
        }
    };


    //// Functions: intervals

    // Set the fastest mediaplayer's timeline as the normalized time
    $scope.setNormalizedTime = function() {
        if (($scope.players[0] && $scope.players[0].isDynamic()) || ($scope.players[1] && $scope.players[1].isDynamic()) || ($scope.players[2] && $scope.players[2].isDynamic()) || ($scope.players[3] && $scope.players[3].isDynamic()) || ($scope.players[4] && $scope.players[4].isDynamic()) || ($scope.players[5] && $scope.players[5].isDynamic())) {
            $scope.normalizedTime = new Date().getTime() / 1000 + $scope.clientServerTimeShift - $scope.startupTime;
        } else {
            for (let i = 0; i < $scope.playerNum; i++) {
                if ($scope.players[i]) {
                    $scope.normalizedTime = $scope.playerTime[i];
                    break;
                }
            }
            if ($scope.normalizedTime) {
                for (let i = 0; i <= $scope.playerNum; i++) {
                    if ($scope.players[i]) {
                        if ($scope.players[i] && $scope.playerTime[i] > $scope.normalizedTime) {
                            $scope.normalizedTime = $scope.playerTime[i];
                        }
                    }
                }
            }
        }
    };

    // Compute total throughput according to recent HTTP requests (Total data in ONE second)
    $scope.computetotalThroughput = function() {
        const precurTime = new Date().getTime() + $scope.clientServerTimeShift * 1000;  // Get current time
        const curTime = precurTime - $scope.requestLayBack;
        let TotalDataInAnInterval = 0;  // Byte
        let TotalTimeInAnInterval = $scope.requestDuration;  // ms
        let requestListLength = $scope.requestList.length;
        let requestListIndex = requestListLength - 1;
        let requestTimeIndex = curTime;
        while (requestListLength > 0 && requestListIndex >= 0) {
            let requestFinishTime = $scope.requestList[requestListIndex].request._tfinish.getTime();
            let requestResponseTime = $scope.requestList[requestListIndex].request.tresponse.getTime();
            if (requestFinishTime > curTime - $scope.requestDuration && requestResponseTime < curTime) {
                // Accumulate the downloaded data (Byte)
                let requestDownloadBytes = $scope.requestList[requestListIndex].request.trace.reduce((a, b) => a + b.b[0], 0);
                if (requestResponseTime > curTime - $scope.requestDuration) {
                    if (requestFinishTime <= curTime) {
                        TotalDataInAnInterval += requestDownloadBytes;
                    } else {
                        TotalDataInAnInterval += ( requestDownloadBytes * ( ( curTime - requestResponseTime ) / ( requestFinishTime - requestResponseTime ) ) );
                    }
                } else {
                    if (requestFinishTime <= curTime) {
                        TotalDataInAnInterval += ( requestDownloadBytes * ( ( requestFinishTime - (curTime - $scope.requestDuration) ) / ( requestFinishTime - requestResponseTime ) ) );
                    } else {
                        TotalDataInAnInterval += ( requestDownloadBytes * ( $scope.requestDuration / ( requestFinishTime - requestResponseTime ) ) );
                    }
                }
                // Subtract the free time (ms)
                if (requestTimeIndex > requestFinishTime) {
                    TotalTimeInAnInterval -= (requestTimeIndex - requestFinishTime);
                }
                // More the time index forward
                if (requestTimeIndex > requestResponseTime) {
                    requestTimeIndex = requestResponseTime;
                }
            }
            requestListIndex--;
        }
        if (curTime - $scope.requestDuration < requestTimeIndex) {
            TotalTimeInAnInterval -= (requestTimeIndex - (curTime - $scope.requestDuration));
        }
        if (TotalDataInAnInterval != 0 && TotalTimeInAnInterval != 0) {
            $scope.totalThroughput = Math.round((8 * TotalDataInAnInterval) / (TotalTimeInAnInterval / 1000));  // bps
        }
    };

    // Compute QoE
    $scope.computeQoE = function() {
        if ($scope.playerPastDownloadingQuality.length == 0 || $scope.playerDownloadingQuality.length == 0) {
            $scope.totalQOE = NaN;
            $scope.playerPastDownloadingQuality = $scope.playerDownloadingQuality;
            return;
        }
        let pretotalQOE = 0;  // = Quality - miu * Stalls - lambda * Quality switches
        let temptotalQOE = 0;
        for (let i = 0; i < $scope.playerNum; i++) {
            ////////////////////////////////// Regardless of stall, only totalQOE //////////////////////////////////
            if ($scope.playerBitrateList[i] && $scope.playerDownloadingQuality[i] && $scope.playerBitrateList[i][$scope.playerDownloadingQuality[i]] && $scope.playerBitrateList[i][$scope.playerDownloadingQuality[i]].bitrate) {
                switch ($scope.qQOE) {
                    case 'linear':
                        temptotalQOE = ($scope.playerBitrateList[i][$scope.playerDownloadingQuality[i]].bitrate - $scope.playerBitrateList[i][0].bitrate) - $scope.lambdaQOE * Math.abs($scope.playerBitrateList[i][$scope.playerDownloadingQuality[i]].bitrate - $scope.playerBitrateList[i][$scope.playerPastDownloadingQuality[i]].bitrate);
                        break;
                    case 'log':
                        temptotalQOE = Math.log(($scope.playerBitrateList[i][$scope.playerDownloadingQuality[i]].bitrate - $scope.playerBitrateList[i][0].bitrate) + 1) - $scope.lambdaQOE * Math.abs(Math.log($scope.playerBitrateList[i][$scope.playerDownloadingQuality[i]].bitrate + 1) - Math.log($scope.playerBitrateList[i][$scope.playerPastDownloadingQuality[i]].bitrate + 1));
                        break;
                    default:
                        break;
                }
            }
            if (temptotalQOE > pretotalQOE) {
                pretotalQOE = temptotalQOE;
            }
        }
        $scope.totalQOE = pretotalQOE;
        $scope.playerPastDownloadingQuality = $scope.playerDownloadingQuality;
    };

    // Capture the pictures from mediaplayers
    $scope.capturePictures = function() {
        for (let i = 0; i < $scope.playerNum; i++) {
            if ($scope.players[i]) {
                document.getElementById("capture_" + i).getContext('2d').drawImage($scope.selectedMode == 'Multi-Path' ? document.getElementById( "video_" + i ) : $scope.selectedMode == 'VR' ? document.getElementById( "frame" ).contentWindow.document.querySelector("#" + "video_" + i) : null, 0, 0, $scope.drawmycanvas.width, $scope.drawmycanvas.height);
                document.getElementById("capture_" + i).style = "width: 150px; height: " + (150 * ($scope.playerBitrateList[i][0] ? ($scope.playerBitrateList[i][0].height / $scope.playerBitrateList[i][0].width) : 150)) + "px";
                // img.src = canvas.toDataURL("image/png");
            }
        }
    };

    // Update settings according to catchup parameters in options
    $scope.updateCatchupSettings = function() {
        for (let i = 0; i <= $scope.playerNum; i++) {
            if ($scope.players[i]) {
                $scope.players[i].updateSettings({
                    'streaming': {
                        'delay': {
                            'liveDelay': $scope.targetLatency
                        },
                        'liveCatchup': {
                            'minDrift': $scope.minDrift,
                            'maxDrift': $scope.maxDrift,
                            'playbackRate': $scope.catchupPlaybackRate,
                            'latencyThreshold': $scope.liveCatchupLatencyThreshold
                        }
                    }
                });
            }
        }
    };

    // Show the data in monitor
    $scope.updateStats = function() {
        $scope.stats.splice(0, $scope.stats.length);
        for (let i = 0; i <= $scope.playerNum; i++) {
            if ($scope.players[i]) {
                // Initialize playerBitrateList and playerTotalBitrateList
                if (i < $scope.playerNum && $scope.playerBitrateList[i].length == 0) {
                    $scope.playerBitrateList[i] = $scope.players[i].getBitrateInfoListFor("video");
                    if ($scope.playerBitrateList[i].length > 0) {
                        for (let ii = 0; ii < $scope.playerBitrateList[i].length; ii++) {
                            let j = 0;
                            while (j < $scope.playerTotalBitrateList.length) {
                                if ($scope.playerBitrateList[i][ii].bitrate > $scope.playerTotalBitrateList[j].bitrate) {
                                    j++;
                                } else if ($scope.playerBitrateList[i][ii].bitrate == $scope.playerTotalBitrateList[j].bitrate) {
                                    $scope.playerTotalBitrateList[j].count[$scope.playerTotalBitrateList[j].count.length] = i;
                                    break;
                                } else if ($scope.playerBitrateList[i][ii].bitrate < $scope.playerTotalBitrateList[j].bitrate) {
                                    for (let k = $scope.playerTotalBitrateList.length - 1; k >= j; k--) {
                                        $scope.playerTotalBitrateList[k + 1] = $scope.playerTotalBitrateList[k];
                                    }
                                    $scope.playerTotalBitrateList[j] = $scope.playerBitrateList[i][ii];
                                    $scope.playerTotalBitrateList[j].count = [];
                                    $scope.playerTotalBitrateList[j].count[0] = i;
                                    break;
                                }
                            }
                            if (j == $scope.playerTotalBitrateList.length) {
                                $scope.playerTotalBitrateList[j] = $scope.playerBitrateList[i][ii];
                                $scope.playerTotalBitrateList[j].count = [];
                                $scope.playerTotalBitrateList[j].count[0] = i;
                            }
                        }
                    }
                }
                // Calculate bufferLength, averageThroughput, timeline, loadedTimeline and downloadingQuality for each path by APIs
                $scope.playerBufferLength[i] = $scope.players[i].getBufferLength(i == $scope.playerNum ? "audio" : "video");
                $scope.playerBufferLength[i] = $scope.playerBufferLength[i] > 0 ? $scope.playerBufferLength[i] : 0;
                $scope.playerAverageThroughput[i] = $scope.players[i].getAverageThroughput(i == $scope.playerNum ? "audio" : "video");
                $scope.playerTime[i] = $scope.players[i].isDynamic() ? $scope.players[i].getVideoElement().currentTime : $scope.players[i].time();
                $scope.loadedTime[i] = $scope.requestList.length > 0 ? $scope.requestList[$scope.requestList.length - 1].request.mediaStartTime + $scope.requestList[$scope.requestList.length - 1].request._mediaduration : NaN;
                $scope.playerDownloadingQuality[i] = $scope.players[i].getQualityFor(i == $scope.playerNum ? "audio" : "video");
                // $scope.playerPlaybackQuality is changed by trigger
                // Calculate RTT for each path
                let playerRTTTemp = 0;
                let playerRTTCount = 0;
                for (let j = $scope.requestList.length - 1; j >= 0; j--) {
                    if ($scope.requestList[j].count == i && playerRTTCount < $scope.GET_SAMPLE_WINDOW_SIZE_FOR_RTT) {
                        let temp1 = $scope.requestList[j].request.tresponse.getTime();
                        let temp2 = $scope.requestList[j].request.trequest.getTime();
                        playerRTTTemp += (temp1 - temp2);
                        playerRTTCount++;
                    }
                }
                $scope.playerRTT[i] = playerRTTCount == 0 ? Infinity : playerRTTTemp / playerRTTCount;
                // Push stats in the table
                $scope.stats.push({
                    playerid : i == $scope.playerNum ? "audio" : "video " + (i + 1),
                    bufferlevel : $scope.playerBufferLength[i].toFixed(2) + " s",
                    throughput : ($scope.playerAverageThroughput[i] / 1000).toFixed(0)+ " kbps",
                    time : $scope.playerTime[i].toFixed(2) + " s",
                    loadedtime : $scope.loadedTime[i].toFixed(2) + " s",
                    downloadingQuality : $scope.playerDownloadingQuality[i].toFixed(0),
                    playbackQuality: $scope.playerPlaybackQuality[i].toFixed(0),
                    totaltime : ($scope.playerBufferLength[i] + $scope.playerTime[i]).toFixed(2) + " s",
                    playerCatchUp : ($scope.playerCatchUp[i] ? "Catching up" : "Synchronizing"),
                    playerRTT : $scope.playerRTT[i].toFixed(1) + " ms"
                });
            }
        }
    };

    // Display different path's player according to downloading qualities
    $scope.switchPath = function() {
        let temp = 0;
        switch ($scope.pathSwitchStrategy) {
            case 0:
                temp = $scope.preferredPathID - 1;
                break;
            case 1:
                for (let i = 0; i < $scope.playerNum; i++) {
                    if ($scope.playerDownloadingQuality[i] > $scope.playerDownloadingQuality[temp]) {
                        temp = i;
                    }
                }
                break;
            case 2:
                for (let i = 0; i < $scope.playerNum; i++) {
                    if ($scope.playerPlaybackQuality[i] > $scope.playerPlaybackQuality[temp]) {
                        temp = i;
                    }
                }
                break;
            case 3:
                let candidates = Array.apply(null, { length: $scope.playerNum }).map((item, index)=>{
                    return index;
                });
                // Give up all empty-buffer paths
                for (let i = 0; i < $scope.playerNum; i++) {
                    if ($scope.buffer_empty_flag[i] || $scope.playerPlaybackQuality[i] == -1) {
                        candidates = candidates.filter(item => item != i);
                    }
                }
                if (candidates.length >= 1) {
                    temp = candidates[0];
                    if (candidates.length > 1) {
                        // Give up all non-sync paths
                        if ($scope.normalizedTime) {
                            for (let i = 0; i < $scope.playerNum; i++) {
                                if ($scope.normalizedTime - $scope.targetLatency - $scope.players[i].getVideoElement().currentTime > $scope.preferredSyncDelay) {
                                    candidates = candidates.filter(item => item != i);
                                }
                            }
                        }
                        if (candidates.length >= 1) {
                            temp = candidates[0];
                            if (candidates.length > 1 && $scope.playerBitrateList) {
                                // Switch according to playback qualities
                                for (let i = 0; i < candidates.length; i++) {
                                    if ($scope.playerBitrateList[candidates[i]] && $scope.playerPlaybackQuality[candidates[i]] >= 0 && $scope.playerBitrateList[candidates[i]][$scope.playerPlaybackQuality[candidates[i]]] && $scope.playerBitrateList[candidates[i]][$scope.playerPlaybackQuality[candidates[i]]].bitrate) {
                                        if ($scope.playerBitrateList[candidates[i]][$scope.playerPlaybackQuality[candidates[i]]].bitrate > $scope.playerBitrateList[temp][$scope.playerPlaybackQuality[temp]].bitrate) {
                                            temp = candidates[i];
                                        }
                                    } else {
                                        temp = candidates[0];
                                        return;
                                    }
                                }
                            }
                        }
                    }
                }
                break;
            case 4:
                return;
            default:
                break;
        }
        $scope.currentPathID = temp + 1;
        document.getElementById("video_" + temp).style.display = "flex";
        for (let i = 0; i < $scope.playerNum; i++) {
            if (i != temp) {
                document.getElementById("video_" + i).style.display = "none";
            }
        }
    };

    // Set up the qualities when using MultiPathRule and GlobalSwitchRule
    $scope.updateMultiPathQualities = function() {
        if ($scope.playerNum == 1) {
            if (document.getElementById('MultiPathRule').checked) {
                if (document.getElementById('Keep-highest-with-same-MPD').checked) {
                    $scope.multiPathQuality[0] = $scope.playerBitrateList[0].length - 1;
                }
                if (document.getElementById('Buffer-besed-with-same-MPD').checked) {
                    if ($scope.playerBufferLength[0] < ($scope.targetLatency / 5)) {
                        $scope.multiPathQuality[0] = Math.max($scope.multiPathQuality[0] - 1, $scope.lifeSignalEnabled && $scope.playerBitrateList[0].length > 1 ? 1 : 0);
                    } else if ($scope.playerBufferLength[0] > ($scope.targetLatency / 2)) {
                        $scope.multiPathQuality[0] = Math.min($scope.multiPathQuality[0] + 1, $scope.playerBitrateList[0].length - 1);
                    }
                }
            } else if (document.getElementById('GlobalSwitchRule').checked) {
                $scope.multiPathQuality[0] = $scope.globalQuality.video;
            }
        } else {
            if (document.getElementById('MultiPathRule').checked) {
                let playerVideoRTT = $scope.playerRTT;
                if ($scope.playerRTT.length == $scope.playerNum + 1) {
                    playerVideoRTT.pop();
                }
                if (!playerVideoRTT.reduce((a, b) => a + b) || playerVideoRTT.reduce((a, b) => a + b) == Infinity) {
                    $scope.multiPathQuality = [0, 0, 0, 0, 0, 0];
                    $scope.previousmultiPathQuality = [0, 0, 0, 0, 0, 0];
                    return;
                }
                for (let i = 0; i < $scope.playerNum; i++) {
                    if (playerVideoRTT[i] == Math.min.apply(null, playerVideoRTT)) {
                        if (document.getElementById('Keep-highest-with-same-MPD').checked) {
                            $scope.multiPathQuality[i] = $scope.playerBitrateList[i].length - 1;
                        }
                        if (document.getElementById('Buffer-besed-with-same-MPD').checked) {
                            if ($scope.multiPathQuality[i] == 0) {
                                $scope.multiPathQuality[i] = $scope.previousmultiPathQuality[i];
                            }
                            if ($scope.playerBufferLength[i] < ($scope.targetLatency / 5)) {
                                $scope.multiPathQuality[i] = Math.max($scope.multiPathQuality[i] - 1, $scope.lifeSignalEnabled && $scope.playerBitrateList[i].length > 1 ? 1 : 0);
                            } else if ($scope.playerBufferLength[i] > ($scope.targetLatency / 2)) {
                                $scope.multiPathQuality[i] = Math.min($scope.multiPathQuality[i] + 1, $scope.playerBitrateList[i].length - 1);
                            }
                        }
                        $scope.changeQualityFlag[i] = 1;
                    }
                }
            } else if (document.getElementById('GlobalSwitchRule').checked) {
                let tempIndex = $scope.playerTotalBitrateList[$scope.globalQuality.video].count;
                let tempRRT = [];
                for (let i = 0; i < tempIndex.length; i++) {
                    tempRRT[i] = $scope.playerRTT[tempIndex[i]];
                }
                let i = tempIndex[tempRRT.indexOf(Math.min.apply(null, tempRRT))];
                for (let j = 0; j < $scope.playerBitrateList[i].length; j++) {
                    if ($scope.playerBitrateList[i][j].bitrate == $scope.playerTotalBitrateList[$scope.globalQuality.video].bitrate) {
                        $scope.multiPathQuality[i] = j;
                        $scope.changeQualityFlag[i] = 1;
                        break;
                    }
                }
            }
        }
    };

    // Other platform intervals
    // setInterval(() => {
    //     $scope.UTCTime = new Date(parseInt(new Date().getTime() + $scope.clientServerTimeShift * 1000)).toLocaleString();
    //     $scope.preferredPathID = $scope.preferredPathID > $scope.playerNum ? $scope.playerNum : $scope.preferredPathID;
    //     if ($scope.playerTotalBitrateList && $scope.playerTotalBitrateList.length > 0) {
    //         $scope.globalQuality.video = $scope.globalQuality.video >= $scope.playerTotalBitrateList.length ? $scope.playerTotalBitrateList.length - 1 : $scope.globalQuality.video;
    //     }
    // }, $scope.IntervalOfPlatformAdjustment);

});