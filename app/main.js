var app = angular.module('DashPlayer', ['angular-flot']);

app.controller('DashController', ['$scope','$interval', function ($scope, $interval) {

    $interval(function () {}, 1);

/////////////////////////////////////////////////////////////////////////////////////
    $scope.mediaSource = null;  // Container for the MediaSource object
    $scope.streamElement = null;  // Container for video element in HTML page
    $scope.streamSourceBuffer = {  // Containers for SourceBuffers
        video: null,
        audio: null
    }
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
    }
    $scope.streamMimeCodecs = {  // MIME types and codecs of streams
        video: NaN,
        audio: NaN
    }
    $scope.streamInfo = {  // Information of streams selected
        video: {
            pathIndex: NaN,
            periodIndex: NaN,
            adaptationSetIndex: NaN,
            representationIndex: NaN,
            segmentIndex: NaN
        },
        audio: {
            pathIndex: NaN,
            periodIndex: NaN,
            adaptationSetIndex: NaN,
            representationIndex: NaN,
            segmentIndex: NaN
        }
    };
    $scope.matchers = [  // Matchers for data adjustments (dash.js)
        new DurationMatcher(),
        new DateTimeMatcher(),
        new NumericMatcher(),
        new StringMatcher()
    ];
    $scope.DOMNodeTypes = {  // Node types for parsers
        ELEMENT_NODE 	   : 1,
        TEXT_NODE    	   : 3,
        CDATA_SECTION_NODE : 4,
        COMMENT_NODE	   : 8,
        DOCUMENT_NODE 	   : 9
    };
/////////////////////////////////////////////////////////////////////////////////////

    //// Global variables (containers: cannot adjust mannually)

    $scope.players = [];  // Container for DASH players
    $scope.controllBars = null;  // Container for controllbars
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
    $scope.selectedRule = "MultiPathRule";  // Save the selected ABR strategy
    $scope.selectedMode = 'Multi-Path';  // Save the selected mode
    $scope.schedulingTimeout = 500;  // Scheduling timeout
    $scope.targetLatency = 10;  // The live delay allowed
    $scope.minDrift = 0.02;  // The minimal latency deviation allowed
    $scope.maxDrift = 3;  // The maximal latency deviation allowed
    $scope.catchupPlaybackRate = 0.5;  // Catchup playback rate
    $scope.liveCatchupLatencyThreshold = 60;  // Maximal latency allowed to catch up
    $scope.pathSwitchStrategy = 3;  // ID of path switching strategy
    $scope.preferredPathID = 1;  // Switch the path of stream manually
    $scope.preferredSyncDelay = 0.5;  // Set the tolerance of sync delay (s)
    $scope.preferredQualitySelected = 0;  // Switch the quality by manual switching ABR strategy and multipath ABR strategy
    $scope.lifeSignalEnabled = false;  // Whether discard the lowest bitrate as life signals or not
    $scope.videoURLs = [  // Save the selected media source
        "http://222.20.126.109:8080/ffz/apple/v9/stream.mpd",
        "http://222.20.126.109:8080/ffz/apple/v9/stream.mpd",
        "http://222.20.126.109:8080/ffz/apple/v9/stream.mpd",
        "http://222.20.126.109:8080/ffz/apple/v9/stream.mpd",
        "http://222.20.126.109:8080/ffz/apple/v9/stream.mpd",
        "http://222.20.126.109:8080/ffz/apple/v9/stream.mpd",
        "http://222.20.126.109:8080/ffz/apple/v9/stream.mpd"
    ];
    $scope.audioURLs = [  // Save the selected media source
        "http://222.20.126.109:8080/ffz/apple/v9/stream.mpd"
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
                document.getElementById( "videoContainerVR=" ).style.display = "none";
                document.getElementById( "videoContainer=" ).style.display = "block";
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
                document.getElementById( "videoContainerVR=" ).style.display = "block";
                document.getElementById( "videoContainer=" ).style.display = "none";
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
        if ($scope.selectedRule == "GlobalSwitchRule") {
            document.getElementById('preferred-quality-selected-video').removeAttribute("disabled");
        } else {
            document.getElementById('preferred-quality-selected-video').disabled = true;
        }
        if ($scope.selectedRule == "MultiPathRule") {
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
        document.getElementById( "DefaultRule" ).disabled = "true";
        document.getElementById( "MyThroughputRule" ).disabled = "true";
        document.getElementById( "MultiPathRule" ).disabled = "true";
        document.getElementById( "HighestBitrateRule" ).disabled = "true";
        document.getElementById( "LowestBitrateRule" ).disabled = "true";
        document.getElementById( "GlobalSwitchRule" ).disabled = "true";
        document.getElementById( "video_num_1" ).disabled = "true";
        document.getElementById( "video_num_2" ).disabled = "true";
        document.getElementById( "video_num_3" ).disabled = "true";
        document.getElementById( "video_num_4" ).disabled = "true";
        document.getElementById( "video_num_5" ).disabled = "true";
        document.getElementById( "video_num_6" ).disabled = "true";
        document.getElementById( "audio_num_0" ).disabled = "true";
        document.getElementById( "audio_num_1" ).disabled = "true";
        document.getElementById( "scheduling-timeout" ).disabled = "true";
        document.getElementById( "life_signal" ).disabled = "true";
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

    };

    // Fetch MPDs with XMLHttpRequests
    $scope.fetchMpd = function(url, callback) {

        if (url == "") {
            window.alert("Empty URL when fetching MPD!");
            return;
        }

        var xhr = new XMLHttpRequest();
        xhr.open('get', url, true);
        xhr.responseType = 'text';
        xhr.onload = function () {
            callback(xhr.response);
        };

        xhr.send();

    };

    // Load MPDs from responses and initialize
    $scope.loadMpd = function(response, type, i) {

        var parser = new DOMParser();
        var xmlData = parser.parseFromString(response, "text/xml");
        var manifest = $scope.parseManifest(xmlData);
        
        if (!manifest.MPD) {
            window.alert("Wrong manifest of " + type + "URLs[" + i + "]: No children node MPD in the manifest!");
            return;
        }
        manifest = manifest.MPD;

        manifest.baseUrl = type == "video" ? $scope.videoURLs[i].slice(0, $scope.videoURLs[i].lastIndexOf("/") + 1) : type == "audio" ? $scope.audioURLs[i].slice(0, $scope.audioURLs[i].lastIndexOf("/") + 1) : undefined;
        if (!manifest.baseUrl || manifest.baseUrl == "") {
            window.alert("Wrong manifest of " + type + "URLs[" + i + "]: No base URL available in the manifest!");
            return;
        }

        $scope.streamMpds[type][i] = manifest;
        console.log("StreamMpds." + type + "[" + i + "] is loaded!");
        $scope.register($scope.streamMpds[type][i], type, i);

    };

    // Extract MPD nodes from XML data
    $scope.parseManifest = function(node, path) {

        if (node.nodeType == $scope.DOMNodeTypes.DOCUMENT_NODE) {  // Read the root node and its children nodes
            var result = new Object;
            var nodeChildren = node.childNodes;
            for (let i = 0; i < nodeChildren.length; i++) {
                var child = nodeChildren[i];
                if (child.nodeType == $scope.DOMNodeTypes.ELEMENT_NODE) {
                    result = {};
                    result[child.localName] = $scope.parseManifest(child);
                }
            }
            return result;
        } else if (node.nodeType == $scope.DOMNodeTypes.ELEMENT_NODE) {  // Read the element nodes and their children nodes
            var result = new Object;
            result.__cnt = 0;
            var nodeChildren = node.childNodes;
            
            // Extract children nodes
            for (let i = 0; i < nodeChildren.length; i++) {
                var child = nodeChildren[i];
                var childName = child.localName;
                if (child.nodeType != $scope.DOMNodeTypes.COMMENT_NODE) {
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
        } else if (node.nodeType == $scope.DOMNodeTypes.TEXT_NODE || node.nodeType == $scope.DOMNodeTypes.CDATA_SECTION_NODE) {  // Read the text and cdata_section nodes
            return node.nodeValue.trim();
        }

    };

    // Executed when MPDs are loaded
    $scope.register = function(manifest, type, i) {  //////////////////////////////

        try {
            // Register bitrate lists
            let registerBitrateListsResult = $scope.registerBitrateLists(manifest, type, i);
            if (registerBitrateListsResult != "SUCCESS") {
                throw registerBitrateListsResult;
            }

            // Register stream information and create SourceBuffer
            if (!$scope.streamSourceBuffer[type]) {
                // Register stream information
                let registerStreamInfoResult = $scope.registerStreamInfo(manifest, type, i, registerBitrateListsResult);
                if (registerStreamInfoResult != "SUCCESS") {
                    throw registerStreamInfoResult;
                }
            }
        } catch (e) {
            window.alert("Error when registerring " + type + " " + i + (e == "" ? e : ": " + e));
        }
    
    };

    // Register bitrate lists
    $scope.registerBitrateLists = function(manifest, type, i) {
        
        try {
            $scope.streamBitrateLists[type][i] = [];
            if (!manifest.Period || manifest.Period.length == 0) {
                throw "No period is available in path " + i + "!";
            }
            for (let j = 0; j < manifest.Period.length; j++) {
                $scope.streamBitrateLists[type][i][j] = [];
                if (!manifest.Period[j].AdaptationSet || manifest.Period[j].AdaptationSet.length == 0) {
                    throw "No adaptation set is available in path " + i + ", period " + j + "!";
                }
                for (let jj = 0; jj < manifest.Period[j].AdaptationSet.length; jj++) {
                    if (manifest.Period[j].AdaptationSet[jj].contentType == type) {
                        $scope.streamBitrateLists[type][i][j][jj] = [];
                        if (!manifest.Period[j].AdaptationSet[jj].Representation || manifest.Period[j].AdaptationSet[jj].Representation.length == 0) {
                            throw "No representation is available in path " + i + ", period " + j + ", adaptation set " + jj + "!";
                        }
                        for (let jjj = 0; jjj < manifest.Period[j].AdaptationSet[jj].Representation.length; jjj++) {
                            $scope.streamBitrateLists[type][i][j][jj][jjj] = manifest.Period[j].AdaptationSet[jj].Representation[jjj].bandwidth;
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
    $scope.registerStreamInfo = function(manifest, type, i, registerBitrateListsResult) {

        try {
            // Check bitrate lists
            if (registerBitrateListsResult != "SUCCESS") {
                throw "Bitrate lists of path " + i + " is not registered!";
            }
            var tempStreamInfo = {};
            // pathIndex
            tempStreamInfo.pathIndex = i;
            // periodIndex
            if (!manifest.Period || manifest.Period.length == 0) {
                throw "No period is available in path " + i + "!";
            }
            for (let j = 0; j < manifest.Period.length; j++) {
                if (manifest.Period[j].start == 0) {
                    tempStreamInfo.periodIndex = j;
                    // adaptationSetIndex
                    if (!manifest.Period[j].AdaptationSet || manifest.Period[j].AdaptationSet.length == 0) {
                        throw "No adaptation set is available in path " + i + ", period " + j + "!";
                    }
                    for (let jj = 0; jj < manifest.Period[j].AdaptationSet.length; jj++) {
                        if (manifest.Period[j].AdaptationSet[jj].contentType == type && manifest.Period[j].AdaptationSet[jj].Representation != undefined && manifest.Period[j].AdaptationSet[jj].Representation.length > ($scope.lifeSignalEnabled ? 1 : 0)) {
                            tempStreamInfo.adaptationSetIndex = jj;
                            // representationIndex
                            let firstsmall, secondsmall;
                            for (let jjj = 0; jjj < manifest.Period[j].AdaptationSet[jj].Representation.length; jjj++) {
                                if ($scope.streamBitrateLists[type] && $scope.streamBitrateLists[type][i] && $scope.streamBitrateLists[type][i][j] && $scope.streamBitrateLists[type][i][j][jj] && $scope.streamBitrateLists[type][i][j][jj][jjj]) {
                                    if (!firstsmall) {
                                        firstsmall = { key: jjj, value: $scope.streamBitrateLists[type][i][j][jj][jjj] };
                                    } else if (firstsmall && !secondsmall) {
                                        if ($scope.streamBitrateLists[type][i][j][jj][jjj] < firstsmall.value) {
                                            secondsmall = firstsmall;
                                            firstsmall = { key: jjj, value: $scope.streamBitrateLists[type][i][j][jj][jjj] };
                                        } else {
                                            secondsmall = { key: jjj, value: $scope.streamBitrateLists[type][i][j][jj][jjj] };
                                        }
                                    } else if (!firstsmall && secondsmall) {
                                        throw "Error when selecting representation";
                                    } else {
                                        if ($scope.streamBitrateLists[type][i][j][jj][jjj] < firstsmall.value) {
                                            secondsmall = firstsmall;
                                            firstsmall = { key: jjj, value: $scope.streamBitrateLists[type][i][j][jj][jjj] };
                                        } else if ($scope.streamBitrateLists[type][i][j][jj][jjj] < secondsmall) {
                                            secondsmall = { key: jjj, value: $scope.streamBitrateLists[type][i][j][jj][jjj] };
                                        }
                                    }
                                }
                            }
                            if ((!$scope.lifeSignalEnabled) && firstsmall) {
                                tempStreamInfo.representationIndex = firstsmall.key;
                                break;
                            }
                            if ($scope.lifeSignalEnabled && secondsmall) {
                                tempStreamInfo.representationIndex = firstsmall.key;
                                break;
                            }
                        }
                        if (jj == manifest.Period[j].AdaptationSet.length - 1) {
                            throw "No adaptation set is suitable for the type!";
                        }
                    }
                    break;
                }
                if (j == manifest.Period.length - 1) {
                    throw "No period starts at 0!";
                }
            }
            // segmentIndex
            tempStreamInfo.segmentIndex = 0;  //////////////////////

            // Create SourceBuffer with MIME and codecs
            if (!$scope.streamSourceBuffer[type]) {
                $scope.streamInfo[type] = tempStreamInfo;
                var mimeFromMpd = manifest.Period[$scope.streamInfo[type].periodIndex].AdaptationSet[$scope.streamInfo[type].adaptationSetIndex].Representation[$scope.streamInfo[type].representationIndex].mimeType;
                var codecsFromMpd = manifest.Period[$scope.streamInfo[type].periodIndex].AdaptationSet[$scope.streamInfo[type].adaptationSetIndex].Representation[$scope.streamInfo[type].representationIndex].codecs;
                $scope.streamMimeCodecs[type] = mimeFromMpd + "; codecs=\"" + codecsFromMpd + "\"";
                $scope.streamSourceBuffer[type] = $scope.mediaSource.addSourceBuffer($scope.streamMimeCodecs[type]);
                return "SUCCESS";
            } else {
                throw "The registeration of path " + i + " is aborted!";
            }
        } catch (e) {
            return "registerStreamInfo: " + e;
        }

    };

    $scope.fetchBuffer = function(url, callback) {

        var xhr = new XMLHttpRequest();
        xhr.open('get', url);
        xhr.responseType = 'arraybuffer';
        xhr.onload = function () {
            callback(xhr.response);
        };
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
        $scope.initial();
    };

    // Initializing DASH players
    $scope.initial = function() {
        $scope.players = [];
        let video, url;

        // Video part
        for (let i = 0; i < $scope.playerNum; i++) {
            video = $scope.selectedMode == 'Multi-Path' ? document.getElementById( "video_" + i ) : $scope.selectedMode == 'VR' ? document.getElementById( "frame" ).contentWindow.document.querySelector("#" + "video_" + i) : null;
            $scope.players[i] = new dashjs.MediaPlayer().create();
            url = $scope.videoURLs[i];
            $scope.buffer_empty_flag[i] = true;

            // Don't use dash.js default rules
            $scope.players[i].updateSettings({
                'info': {
                    'id': "video_" + i,
                    'count': i,
                    'totalThroughputNeeded': true
                },
                'streaming': {
                    'buffer': {
                        'bufferToKeep': $scope.playerBufferToKeep,
                        'stableBufferTime': $scope.playerStableBufferTime,
                        'bufferTimeAtTopQuality': $scope.playerBufferTimeAtTopQuality,
                        'bufferTimeAtTopQualityLongForm': $scope.playerBufferTimeAtTopQualityLongForm,
                        'fastSwitchEnabled': true
                    },
                    'delay': {
                        'liveDelay': $scope.targetLatency
                    },
                    'liveCatchup': {
                        'enabled': true,
                        'minDrift': $scope.minDrift,
                        'maxDrift': $scope.maxDrift,
                        'playbackRate': $scope.catchupPlaybackRate,
                        'latencyThreshold': $scope.liveCatchupLatencyThreshold
                    },
                    'scheduling': {
                        'defaultTimeout': $scope.schedulingTimeout
                    }
                // },
                // 'debug': {
                //     'logLevel': 5
                }
            });

            // Add my custom quality switch rule, look at [].js to know more about the structure of a custom rule
            switch ($scope.selectedRule) {
                case "MyThroughputRule":
                    $scope.players[i].updateSettings({
                        'streaming': {
                            'abr': {
                                'useDefaultABRRules': false
                            }
                        }
                    });
                	$scope.players[i].addABRCustomRule('qualitySwitchRules', 'MyThroughputRule', MyThroughputRule);
                	break;
                case "MultiPathRule":
                    $scope.players[i].updateSettings({
                        'streaming': {
                            'abr': {
                                'useDefaultABRRules': false
                            }
                        }
                    });
                    $scope.players[i].addABRCustomRule('qualitySwitchRules', 'MultiPathRule', MultiPathRule);
                    break;
                case "HighestBitrateRule":
                    $scope.players[i].updateSettings({
                        'streaming': {
                            'abr': {
                                'useDefaultABRRules': false
                            }
                        }
                    });
                    $scope.players[i].addABRCustomRule('qualitySwitchRules', 'HighestBitrateRule', HighestBitrateRule);
                    break;
                case "LowestBitrateRule":
                    $scope.players[i].updateSettings({
                        'streaming': {
                            'abr': {
                                'useDefaultABRRules': false
                            }
                        }
                    });
                    $scope.players[i].addABRCustomRule('qualitySwitchRules', 'LowestBitrateRule', LowestBitrateRule);
                    break;
                case "GlobalSwitchRule":
                    $scope.players[i].updateSettings({
                        'streaming': {
                            'abr': {
                                'useDefaultABRRules': false
                            }
                        }
                    });
                    $scope.players[i].addABRCustomRule('qualitySwitchRules', 'GlobalSwitchRule', GlobalSwitchRule);
                    break;
                case "FOVRule":
                    $scope.players[i].updateSettings({
                        'streaming': {
                            'abr': {
                                'useDefaultABRRules': false
                            }
                        }
                    });
                    $scope.players[i].addABRCustomRule('qualitySwitchRules', 'FOVRule', FOVRule);
                    break;
                default:
                    $scope.players[i].updateSettings({
                        'streaming': {
                            'abr': {
                                'useDefaultABRRules': true
                            }
                        }
                    });
                    break;
            }

            // Turn on the event listeners and add actions for triggers 
            $scope.players[i].on(dashjs.MediaPlayer.events["BUFFER_EMPTY"], $scope.buffer_empty_event);
            $scope.players[i].on(dashjs.MediaPlayer.events["BUFFER_LOADED"], $scope.buffer_loaded_event);
            $scope.players[i].on(dashjs.MediaPlayer.events["QUALITY_CHANGE_RENDERED"], $scope.quality_change_rendered);

            // Initializing players
            $scope.players[i].initialize(video, url, false);
            $scope.playerBufferLength[i] = $scope.players[i].getBufferLength("video");
            $scope.playerAverageThroughput[i] = $scope.players[i].getAverageThroughput("video");
            $scope.playerTime[i] = 0;
            $scope.loadedTime[i] = 0;
            $scope.playerDownloadingQuality[i] = $scope.players[i].getQualityFor("video");
            $scope.playerPlaybackQuality[i] = 0;
            $scope.playerBitrateList[i] = [];
            $scope.playerCatchUp[i] = false;
            $scope.playerRTT[i] = Infinity;

            // Initializing charts
            $scope.chartState["downloadingQuality"]["video_" + i] = {
                data: [], color: $scope.chartColor[i], label: 'video ' + (i + 1)
            };
            $scope.chartState["playbackQuality"]["video_" + i] = {
                data: [], color: $scope.chartColor[i], label: 'video ' + (i + 1)
            };
            $scope.chartState["buffer"]["video_" + i] = {
                data: [], color: $scope.chartColor[i], label: 'video ' + (i + 1)
            };
            $scope.chartState["throughput"]["video_" + i] = {
                data: [], color: $scope.chartColor[i], label: 'video ' + (i + 1)
            };
            $scope.chartState["RTT"]["video_" + i] = {
                data: [], color: $scope.chartColor[i], label: 'video ' + (i + 1)
            };
            $scope.chartState["requests"]["video_" + i] = {
                data: [], color: $scope.chartColor[i], label: 'video ' + (i + 1)
            };
        }

        // Audio part
        if ($scope.isAudio && $scope.audioURLs[0] != "") {
            var audio = $scope.selectedMode == 'Multi-Path' ? document.getElementById( "audio" ) : $scope.selectedMode == 'VR' ? document.getElementById( "frame" ).contentWindow.document.querySelector("#" + "audio") : null;
            $scope.players[$scope.playerNum] = new dashjs.MediaPlayer().create();
            url = $scope.audioURLs[0];
            $scope.buffer_empty_flag[$scope.playerNum] = true;

            $scope.players[$scope.playerNum].updateSettings({
                'info': {
                    'id': "audio",
                    'count': $scope.playerNum,
                    'totalThroughputNeeded': true
                },
                'streaming': {
                    // 'abr': {
                    //     'useDefaultABRRules': false
                    // },
                    'buffer': {
                        'bufferToKeep': $scope.playerBufferToKeep,
                        'stableBufferTime': $scope.playerStableBufferTime,
                        'bufferTimeAtTopQuality': $scope.playerBufferTimeAtTopQuality,
                        'fastSwitchEnabled': true
                    },
                    'delay': {
                        'liveDelay': $scope.targetLatency
                    },
                    'liveCatchup': {
                        'enabled': true,
                        'minDrift': $scope.minDrift,
                        'maxDrift': $scope.maxDrift,
                        'playbackRate': $scope.catchupPlaybackRate,
                        'latencyThreshold': $scope.liveCatchupLatencyThreshold
                    },
                    'scheduling': {
                        'defaultTimeout': $scope.schedulingTimeout
                    }
                }
            });

            // Turn on the event listeners and add actions for triggers 
            $scope.players[$scope.playerNum].on(dashjs.MediaPlayer.events["BUFFER_EMPTY"], $scope.buffer_empty_event);
            $scope.players[$scope.playerNum].on(dashjs.MediaPlayer.events["BUFFER_LOADED"], $scope.buffer_loaded_event);
            $scope.players[$scope.playerNum].on(dashjs.MediaPlayer.events["QUALITY_CHANGE_RENDERED"], $scope.quality_change_rendered);

            // Initializing
            $scope.players[$scope.playerNum].initialize(audio, url, false);
            $scope.playerBufferLength[$scope.playerNum] = $scope.players[$scope.playerNum].getBufferLength("audio");
            $scope.playerAverageThroughput[$scope.playerNum] = $scope.players[$scope.playerNum].getAverageThroughput("audio");
            $scope.playerTime[$scope.playerNum] = 0;
            $scope.loadedTime[$scope.playerNum] = 0;
            $scope.playerDownloadingQuality[$scope.playerNum] = $scope.players[$scope.playerNum].getQualityFor("audio");
            $scope.playerPlaybackQuality[$scope.playerNum] = 0;
            $scope.playerCatchUp[$scope.playerNum] = false;
            $scope.playerRTT[$scope.playerNum] = Infinity;

            // Initializing charts
            $scope.chartState["downloadingQuality"]["audio"] = {
                data: [], color: $scope.chartColor[$scope.playerNum], label: 'audio'
            };
            $scope.chartState["playbackQuality"]["audio"] = {
                data: [], color: $scope.chartColor[$scope.playerNum], label: 'audio'
            };
            $scope.chartState["buffer"]["audio"] = {
                data: [], color: $scope.chartColor[$scope.playerNum], label: 'audio'
            };
            $scope.chartState["throughput"]["audio"] = {
                data: [], color: $scope.chartColor[$scope.playerNum], label: 'audio'
            };
            $scope.chartState["RTT"]["audio"] = {
                data: [], color: $scope.chartColor[$scope.playerNum], label: 'audio'
            };
            $scope.chartState["requests"]["audio"] = {
                data: [], color: $scope.chartColor[$scope.playerNum], label: 'audio'
            };
        }

        // Initializing Controllbars
        $scope.controllBars = new ControlBar($scope.players);
        $scope.controllBars.initialize();

        // Initialize charts by media types
        $scope.initChartingByMediaType('downloadingQuality');
        $scope.initChartingByMediaType('playbackQuality');
        $scope.initChartingByMediaType('buffer');
        $scope.initChartingByMediaType('throughput');
        $scope.initChartingByMediaType('RTT');
        $scope.initChartingByMediaType('requests');

        // Set the fastest mediaplayer's timeline as the normalized time
        setInterval($scope.setNormalizedTime, $scope.IntervalOfSetNormalizedTime);
        // Compute total throughput according to recent HTTP requests
        setInterval($scope.computetotalThroughput, $scope.IntervalOfComputetotalThroughput);
        // Compute QoE
        setInterval($scope.computeQoE, $scope.IntervalOfComputeQoE);
        // Capture the pictures from mediaplayers
        setInterval($scope.capturePictures, $scope.IntervalOfCaptures);
        // Update settings according to catchup parameters in options
        setInterval($scope.updateCatchupSettings, $scope.IntervalOfApplyOptions);
        // Show the data in monitor
        setInterval($scope.updateStats, $scope.IntervalOfUpdateStats);
        // Show the data in figures
        setInterval($scope.updateFigures, $scope.IntervalOfUpdateFigures);
        // Show the requests data in figures
        setInterval($scope.updateRequestsFigures, $scope.IntervalOfUpdateRequestsFigures);
        // Display different path's player according to downloading qualities
        setInterval($scope.switchPath, $scope.IntervalOfSwitchPath);
        // Set up the qualities when using MultiPathRule
        setInterval($scope.updateMultiPathQualities, $scope.IntervalOfUpdateMultiPathQualities);

        document.getElementById('Load').style.display = "none";
        document.getElementById('Reload').style.display = "inline-block";
    };

    // Pause in all players
    $scope.pause_all = function() {
        for (let i = 0; i <= $scope.playerNum; i++) {
            if ($scope.players[i]) {
                $scope.players[i].pause();
            }
        }
    };

    // Play in all players
    $scope.play_all = function() {
        for (let i = 0; i <= $scope.playerNum; i++) {
            if ($scope.players[i]) {
                $scope.players[i].play();
            }
        }
    };

    // Triggered when any player's buffer is empty, which to stop all the players and wait for rebuffering.
    $scope.buffer_empty_event = function(e) {
        $scope.buffer_empty_flag[e.info.count] = true;
        if (e.info.count == $scope.playerNum) {
            $scope.pause_all();
        } else {
            for (let i = 0; i < $scope.playerNum; i++) {
                if ($scope.players[i] && !$scope.buffer_empty_flag[i]) {
                    return;
                }
            }
            $scope.pause_all();
        }
    };

    // Triggered when any player's buffer is loaded (again), which to start all the players when all-set.
    $scope.buffer_loaded_event = function(e) {
        $scope.buffer_empty_flag[e.info.count] = false;
        if (e.info.count == $scope.playerNum) {
            for (let i = 0; i < $scope.playerNum; i++) {
                if ($scope.players[i] && !$scope.buffer_empty_flag[i]) {
                    if (!$scope.forcedPause) {
                        $scope.play_all();
                    }
                    return;
                }
            }
        } else {
            if ($scope.players[$scope.playerNum] && $scope.buffer_empty_flag[$scope.playerNum]) {
                return;
            }
            if (!$scope.forcedPause) {
                $scope.play_all();
            }
        }
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
                $scope.multiPathQuality[0] = $scope.preferredQualitySelected;
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
                let tempIndex = $scope.playerTotalBitrateList[$scope.preferredQualitySelected].count;
                let tempRRT = [];
                for (let i = 0; i < tempIndex.length; i++) {
                    tempRRT[i] = $scope.playerRTT[tempIndex[i]];
                }
                let i = tempIndex[tempRRT.indexOf(Math.min.apply(null, tempRRT))];
                for (let j = 0; j < $scope.playerBitrateList[i].length; j++) {
                    if ($scope.playerBitrateList[i][j].bitrate == $scope.playerTotalBitrateList[$scope.preferredQualitySelected].bitrate) {
                        $scope.multiPathQuality[i] = j;
                        $scope.changeQualityFlag[i] = 1;
                        break;
                    }
                }
            }
        }
    };

    // Other platform intervals
    setInterval(() => {
        $scope.UTCTime = new Date(parseInt(new Date().getTime() + $scope.clientServerTimeShift * 1000)).toLocaleString();
        $scope.preferredPathID = $scope.preferredPathID > $scope.playerNum ? $scope.playerNum : $scope.preferredPathID;
        if ($scope.playerTotalBitrateList && $scope.playerTotalBitrateList.length > 0) {
            $scope.preferredQualitySelected = $scope.preferredQualitySelected >= $scope.playerTotalBitrateList.length ? $scope.playerTotalBitrateList.length - 1 : $scope.preferredQualitySelected;
        }
    }, $scope.IntervalOfPlatformAdjustment);

}]);