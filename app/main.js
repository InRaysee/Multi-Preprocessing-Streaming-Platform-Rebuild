//////////////////////////////// InRaysee DASH Player ////////////////////////////////
/*
TODOs:
  [-] 1. ABR rules.
    [ ] 1.1. MyThroughputRule.
    [-] 1.2. MyBufferRule.
    [x] 1.3. HighestBitrateRule.
    [x] 1.4. LowestBitrateRule.
    [x] 1.5. GlobalSwitchRule.
  [x] 2. Path switching.
  [x] 3. Reload.
  [ ] 4. Forced switch quality.
  [x] 5. Multiple stream URLs.
  [-] 6. Data monitors, charts and stats.
  [ ] 7. Module spliting.
  [x] 8. Multiple periods and different segment indexs.
  [ ] 9. Live mode with catchup.
  [ ] 10. VR mode.
*/
//////////////////////////////////////////////////////////////////////////////////////

var app = angular.module('DashPlayer', ['angular-flot']);

app.controller('DashController', ['$scope', '$interval', function ($scope, $interval) {

    $interval(function () {}, 1);

/////////////////////////////////////////////////////////////////////////////////////
    $scope.INTERVAL_OF_PLATFORM_ADJUSTMENT = 10;
    $scope.INTERVAL_OF_UPDATE_CHARTS = 500;
    $scope.INTERVAL_OF_SCHEDULE_FETCHER = 50;
    $scope.INTERVAL_OF_APPEND_BUFFER = 100;
    $scope.TIMEOUT_OF_SOURCE_OPEN = 1;
    $scope.TYPE_OF_MPD = "MPD";
    $scope.TYPE_OF_INIT_SEGMENT = "InitSegment";
    $scope.TYPE_OF_MEDIA_SEGMENT = "MediaSegment";
    $scope.EVENT_TIME_UPDATE = "timeupdate";
    $scope.EVENT_UPDATE_END = "updateend";
    $scope.TAG_OF_REPRESENTATION_ID = "$RepresentationID$";
    $scope.TAG_OF_SEGMENT_INDEX = "$Number$";
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
        myBufferRule: new MyBufferRuleClass(),
        highestBitrateRule: new HighestBitrateRuleClass(),
        lowestBitrateRule: new LowestBitrateRuleClass(),
        globalSwitchRule: new GlobalSwitchRuleClass()
    };

    $scope.intervalFunctions = [];  // Container for all interval functions

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
    $scope.initCache = {  // Caches of init segments loaded
        video: [],
        audio: []
    };
    $scope.streamMpds = {  // Arrays of MPDs
        video: [],
        audio: []
    };
    $scope.streamBitrateLists = {  // Arrays of bitrate lists
        video: [],
        audio: []
    };
    $scope.requestList = [];  // Data from all HTTPRequests

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
    $scope.streamSourceBufferMimeCodecs = {  // Containers for SourceBuffers' mimeCodecs
        video: NaN,
        audio: NaN
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
    $scope.isSeeking = NaN;  // Flag for identifying if seeking the segment
    $scope.startupTime = 0;  // Startup time of streaming
    $scope.startupTimeFormatted = null;  // Formatted startup time of streaming

    $scope.streamNum = {  // Number of paths for fetching streams
        video: 6,
        audio: 2
    }
    $scope.optionButton = "Show Options";  // Save the state of option button
    $scope.selectedRule = "myBufferRule";  // Save the selected ABR strategy
    $scope.selectedMode = 'Multi-Path';  // Save the selected mode
    $scope.targetBuffer = 2;  // The buffer level desired to be fetched
    $scope.globalQuality = {  // Switch the quality by global manual switching ABR strategy
        video: 0,
        audio: 0
    };
    $scope.lifeSignalEnabled = true;  // Whether discard the lowest bitrate as life signals or not

    $scope.availableStreams = [  // All the available preset media sources
        {
            name: "VOD (Akamai BBB $Number$)",
            url: "https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd"
        },
        {
            name: "VOD (Elephant Dream $Time$)",
            url: "https://dash.akamaized.net/dash264/TestCases/2c/qualcomm/1/MultiResMPEG2.mpd"
        },
        {
            name: "VOD (Captions by WebVTT)",
            url: "https://dash.akamaized.net/akamai/test/caption_test/ElephantsDream/elephants_dream_480p_heaac5_1_https.mpd"
        },
        {
            name: "VOD (Multi periods)",
            url: "https://dash.akamaized.net/dash264/TestCases/5a/nomor/1.mpd"
        },
        {
            name: "VOD (Local CMPVP907)",
            urls: {
                video: [
                    "http://localhost:8080/datasets/CMPVP907/face0/output/stream.mpd",
                    "http://localhost:8080/datasets/CMPVP907/face1/output/stream.mpd",
                    "http://localhost:8080/datasets/CMPVP907/face2/output/stream.mpd",
                    "http://localhost:8080/datasets/CMPVP907/face3/output/stream.mpd",
                    "http://localhost:8080/datasets/CMPVP907/face4/output/stream.mpd",
                    "http://localhost:8080/datasets/CMPVP907/face5/output/stream.mpd",
                ],
                audio: [
                    "http://localhost:8080/datasets/CMPVP907/audio/output/stream.mpd",
                    "http://localhost:8080/datasets/CMPVP907/audio/output/stream.mpd"
                ]
            }
        },
        {
            name: "VOD (Local tokyo)",
            url: "http://localhost:8080/datasets/tokyo/v9/stream.mpd"
        },
        {
            name: "VOD (Local apple)",
            url: "http://localhost:8080/datasets/apple/v9/stream.mpd"
        },
        {
            name: "VOD (File BBB)",
            url: "http://222.20.126.108:8080/ffz/akamai/bbb_30fps/bbb_30fps.mpd"
        },
        {
            name: "VOD (File tokyo)",
            url: "http://222.20.126.108:8080/ffz/tokyo/v9/stream.mpd"
        },
        {
            name: "VOD (File apple)",
            url: "http://222.20.126.108:8080/ffz/apple/v9/stream.mpd"
        },
        {
            name: "VOD (File Docker BBB)",
            urls: {
                video: [
                    "http://222.20.126.108:6001/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                    "http://222.20.126.108:6003/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                    "http://222.20.126.108:6005/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                    "http://222.20.126.108:6007/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                    "http://222.20.126.108:6009/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                    "http://222.20.126.108:6011/ffz/akamai/bbb_30fps/bbb_30fps.mpd"
                ],
                audio: [
                    "http://222.20.126.108:6001/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                    "http://222.20.126.108:6001/ffz/akamai/bbb_30fps/bbb_30fps.mpd"
                ]
            }
        },
        {
            name: "VOD (File Docker tokyo)",
            urls: {
                video: [
                    "http://222.20.126.108:6001/ffz/tokyo/v9/stream.mpd",
                    "http://222.20.126.108:6003/ffz/tokyo/v9/stream.mpd",
                    "http://222.20.126.108:6005/ffz/tokyo/v9/stream.mpd",
                    "http://222.20.126.108:6007/ffz/tokyo/v9/stream.mpd",
                    "http://222.20.126.108:6009/ffz/tokyo/v9/stream.mpd",
                    "http://222.20.126.108:6011/ffz/tokyo/v9/stream.mpd"
                ],
                audio: [
                    "http://222.20.126.108:6001/ffz/tokyo/v9/stream.mpd",
                    "http://222.20.126.108:6001/ffz/tokyo/v9/stream.mpd"
                ]
            }
        },
        {
            name: "VOD (File Docker apple)",
            urls: {
                video: [
                    "http://222.20.126.108:6001/ffz/apple/v9/stream.mpd",
                    "http://222.20.126.108:6003/ffz/apple/v9/stream.mpd",
                    "http://222.20.126.108:6005/ffz/apple/v9/stream.mpd",
                    "http://222.20.126.108:6007/ffz/apple/v9/stream.mpd",
                    "http://222.20.126.108:6009/ffz/apple/v9/stream.mpd",
                    "http://222.20.126.108:6011/ffz/apple/v9/stream.mpd"
                ],
                audio: [
                    "http://222.20.126.108:6001/ffz/apple/v9/stream.mpd",
                    "http://222.20.126.108:6001/ffz/apple/v9/stream.mpd"
                ]
            }
        },
        {
            name: "VOD (Edge BBB)",
            url: "http://222.20.126.109:8080/ffz/akamai/bbb_30fps/bbb_30fps.mpd"
        },
        {
            name: "VOD (Edge tokyo)",
            url: "http://222.20.126.109:8080/ffz/tokyo/v9/stream.mpd"
        },
        {
            name: "VOD (Edge apple)",
            url: "http://222.20.126.109:8080/ffz/apple/v9/stream.mpd"
        },
        {
            name: "VOD (Edge Docker BBB)",
            urls: {
                video: [
                    "http://222.20.126.109:6001/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                    "http://222.20.126.109:6003/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                    "http://222.20.126.109:6005/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                    "http://222.20.126.109:6007/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                    "http://222.20.126.109:6009/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                    "http://222.20.126.109:6011/ffz/akamai/bbb_30fps/bbb_30fps.mpd"
                ],
                audio: [
                    "http://222.20.126.109:6001/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                    "http://222.20.126.109:6001/ffz/akamai/bbb_30fps/bbb_30fps.mpd"
                ]
            }
        },
        {
            name: "VOD (Edge Docker tokyo)",
            urls: {
                video: [
                    "http://222.20.126.109:6001/ffz/tokyo/v9/stream.mpd",
                    "http://222.20.126.109:6003/ffz/tokyo/v9/stream.mpd",
                    "http://222.20.126.109:6005/ffz/tokyo/v9/stream.mpd",
                    "http://222.20.126.109:6007/ffz/tokyo/v9/stream.mpd",
                    "http://222.20.126.109:6009/ffz/tokyo/v9/stream.mpd",
                    "http://222.20.126.109:6011/ffz/tokyo/v9/stream.mpd"
                ],
                audio: [
                    "http://222.20.126.109:6001/ffz/tokyo/v9/stream.mpd",
                    "http://222.20.126.109:6001/ffz/tokyo/v9/stream.mpd"
                ]
            }
        },
        {
            name: "VOD (Edge Docker apple)",
            urls: {
                video: [
                    "http://222.20.126.109:6001/ffz/apple/v9/stream.mpd",
                    "http://222.20.126.109:6003/ffz/apple/v9/stream.mpd",
                    "http://222.20.126.109:6005/ffz/apple/v9/stream.mpd",
                    "http://222.20.126.109:6007/ffz/apple/v9/stream.mpd",
                    "http://222.20.126.109:6009/ffz/apple/v9/stream.mpd",
                    "http://222.20.126.109:6011/ffz/apple/v9/stream.mpd"
                ],
                audio: [
                    "http://222.20.126.109:6001/ffz/apple/v9/stream.mpd",
                    "http://222.20.126.109:6001/ffz/apple/v9/stream.mpd"
                ]
            }
        },
        {
            name: "VOD (Zerotier File BBB)",
            url: "http://172.28.0.53:8080/ffz/akamai/bbb_30fps/bbb_30fps.mpd"
        },
        {
            name: "VOD (Zerotier File tokyo)",
            url: "http://172.28.0.53:8080/ffz/tokyo/v9/stream.mpd"
        },
        {
            name: "VOD (Zerotier File apple)",
            url: "http://172.28.0.53:8080/ffz/apple/v9/stream.mpd"
        },
        {
            name: "VOD (Zerotier File Docker BBB)",
            urls: {
                video: [
                    "http://172.28.0.53:6001/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                    "http://172.28.0.53:6003/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                    "http://172.28.0.53:6005/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                    "http://172.28.0.53:6007/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                    "http://172.28.0.53:6009/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                    "http://172.28.0.53:6011/ffz/akamai/bbb_30fps/bbb_30fps.mpd"
                ],
                audio: [
                    "http://172.28.0.53:6001/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                    "http://172.28.0.53:6001/ffz/akamai/bbb_30fps/bbb_30fps.mpd"
                ]
            }
        },
        {
            name: "VOD (Zerotier File Docker tokyo)",
            urls: {
                video: [
                    "http://172.28.0.53:6001/ffz/tokyo/v9/stream.mpd",
                    "http://172.28.0.53:6003/ffz/tokyo/v9/stream.mpd",
                    "http://172.28.0.53:6005/ffz/tokyo/v9/stream.mpd",
                    "http://172.28.0.53:6007/ffz/tokyo/v9/stream.mpd",
                    "http://172.28.0.53:6009/ffz/tokyo/v9/stream.mpd",
                    "http://172.28.0.53:6011/ffz/tokyo/v9/stream.mpd"
                ],
                audio: [
                    "http://172.28.0.53:6001/ffz/tokyo/v9/stream.mpd",
                    "http://172.28.0.53:6001/ffz/tokyo/v9/stream.mpd"
                ]
            }
        },
        {
            name: "VOD (Zerotier File Docker apple)",
            urls: {
                video: [
                    "http://172.28.0.53:6001/ffz/apple/v9/stream.mpd",
                    "http://172.28.0.53:6003/ffz/apple/v9/stream.mpd",
                    "http://172.28.0.53:6005/ffz/apple/v9/stream.mpd",
                    "http://172.28.0.53:6007/ffz/apple/v9/stream.mpd",
                    "http://172.28.0.53:6009/ffz/apple/v9/stream.mpd",
                    "http://172.28.0.53:6011/ffz/apple/v9/stream.mpd"
                ],
                audio: [
                    "http://172.28.0.53:6001/ffz/apple/v9/stream.mpd",
                    "http://172.28.0.53:6001/ffz/apple/v9/stream.mpd"
                ]
            }
        },
        {
            name: "VOD (Zerotier Edge BBB)",
            url: "http://172.28.0.54:8080/ffz/akamai/bbb_30fps/bbb_30fps.mpd"
        },
        {
            name: "VOD (Zerotier Edge tokyo)",
            url: "http://172.28.0.54:8080/ffz/tokyo/v9/stream.mpd"
        },
        {
            name: "VOD (Zerotier Edge apple)",
            url: "http://172.28.0.54:8080/ffz/apple/v9/stream.mpd"
        },
        {
            name: "VOD (Zerotier Edge Docker BBB)",
            urls: {
                video: [
                    "http://172.28.0.54:6001/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                    "http://172.28.0.54:6003/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                    "http://172.28.0.54:6005/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                    "http://172.28.0.54:6007/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                    "http://172.28.0.54:6009/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                    "http://172.28.0.54:6011/ffz/akamai/bbb_30fps/bbb_30fps.mpd"
                ],
                audio: [
                    "http://172.28.0.54:6001/ffz/akamai/bbb_30fps/bbb_30fps.mpd",
                    "http://172.28.0.54:6001/ffz/akamai/bbb_30fps/bbb_30fps.mpd"
                ]
            }
        },
        {
            name: "VOD (Zerotier Edge Docker tokyo)",
            urls: {
                video: [
                    "http://172.28.0.54:6001/ffz/tokyo/v9/stream.mpd",
                    "http://172.28.0.54:6003/ffz/tokyo/v9/stream.mpd",
                    "http://172.28.0.54:6005/ffz/tokyo/v9/stream.mpd",
                    "http://172.28.0.54:6007/ffz/tokyo/v9/stream.mpd",
                    "http://172.28.0.54:6009/ffz/tokyo/v9/stream.mpd",
                    "http://172.28.0.54:6011/ffz/tokyo/v9/stream.mpd"
                ],
                audio: [
                    "http://172.28.0.54:6001/ffz/tokyo/v9/stream.mpd",
                    "http://172.28.0.54:6001/ffz/tokyo/v9/stream.mpd"
                ]
            }
        },
        {
            name: "VOD (Zerotier Edge Docker apple)",
            urls: {
                video: [
                    "http://172.28.0.54:6001/ffz/apple/v9/stream.mpd",
                    "http://172.28.0.54:6003/ffz/apple/v9/stream.mpd",
                    "http://172.28.0.54:6005/ffz/apple/v9/stream.mpd",
                    "http://172.28.0.54:6007/ffz/apple/v9/stream.mpd",
                    "http://172.28.0.54:6009/ffz/apple/v9/stream.mpd",
                    "http://172.28.0.54:6011/ffz/apple/v9/stream.mpd"
                ],
                audio: [
                    "http://172.28.0.54:6001/ffz/apple/v9/stream.mpd",
                    "http://172.28.0.54:6001/ffz/apple/v9/stream.mpd"
                ]
            }
        },
        {
            name: "LIVE (Livesim Single Rate)",
            url: "https://livesim.dashif.org/livesim/chunkdur_1/ato_7/testpic4_8s/Manifest300.mpd"
        },
        {
            name: "LIVE (Cmafref Multi Rates)",
            url: "https://cmafref.akamaized.net/cmaf/live-ull/2006350/akambr/out.mpd"
        },
        {
            name: "LIVE (FileServer)",
            url: "http://222.20.126.108:8000/dash/stream.mpd"
        },
        {
            name: "LIVE (EdgeServer)",
            url: "http://222.20.126.109:8000/dash/stream.mpd"
        },
        {
            name: "LIVE (FS & ES)",
            urls: {
                video: [
                    "http://222.20.126.108:8000/face0/stream.mpd",
                    "http://222.20.126.108:8000/face1/stream.mpd",
                    "http://222.20.126.108:8000/face2/stream.mpd",
                    "http://222.20.126.109:8000/face3/stream.mpd",
                    "http://222.20.126.109:8000/face4/stream.mpd",
                    "http://222.20.126.109:8000/face5/stream.mpd"
                ],
                audio: [
                    "http://222.20.126.108:8000/face0/stream.mpd",
                    "http://222.20.126.108:8000/face0/stream.mpd"
                ]
            }
        },
        {
            name: "COPY"
        },
        {
            name: "CUSTOM"
        }
    ];
    $scope.streamURLs = {  // Save the selected media sources
        video: [
            "http://localhost:8080/apple/v9/stream.mpd",
            "http://localhost:8080/apple/v9/stream.mpd",
            "http://localhost:8080/apple/v9/stream.mpd",
            "http://localhost:8080/apple/v9/stream.mpd",
            "http://localhost:8080/apple/v9/stream.mpd",
            "http://localhost:8080/apple/v9/stream.mpd"
        ],
        audio: [
            "http://localhost:8080/apple/v9/stream.mpd",
            "http://localhost:8080/apple/v9/stream.mpd"
        ]
    };

    $scope.monitorBufferLevel = {  // Monitor data: buffer level
        video: NaN,
        audio: NaN
    };
    $scope.chartData_bufferLevel = [];  // Save the buffer data need to put on the charts
    $scope.maxBufferLevelBuffer = [];  // Buffer for maximal chart data
    $scope.maxBufferLevel = 0;  // Maximal chart data
    $scope.maxPointsToChart = 30;  // Set the maximum of the points printed on the charts
    $scope.chartColor = ['#00CCBE', '#ffd446', '#FF6700', '#44c248', '#ff000a', '#b300ff', '#1100ff'];  // Colors of each objects (6 + 1 as maximum)
    $scope.chartState = {  // Save the charts' states
        downloadingQuality:{},
        playbackQuality:{},
        bufferLevel:{},
        throughput:{},
        RTT:{},
        requests:{}
    };
    $scope.chartOptions_bufferLevel = {  // [For printing the chart] Set up the style of the charts
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
                return $scope.convertToTimeCode(value);
            },
            tickDecimals: 0,
            color: '#136bfb',
            alignTicksWithAxis: 1
        },
        yaxis: {
            min: 0,
            max: $scope.maxBufferLevel,
            tickLength: 0,
            tickDecimals: 0,
            color: '#136bfb',
            position: 'right',
            axisLabelPadding: 10
        },
        yaxes: [{axisLabel: "second"}]
    };



/////////////////////////////////////////////////////////////////////////////////////

    //// Global variables (containers: cannot adjust mannually)

    $scope.clientServerTimeShift = 0;  // Time shift between client and server from TimelineConverter
    $scope.normalizedTime = NaN;  // Set the fastest mediaplayer's timeline as the normalized time
    $scope.totalThroughput = NaN;  // Compute the total throughput considering all players
    $scope.totalQOE = NaN;  // Compute the QoE considering all players (TODO)
    $scope.playerAverageThroughput = [];  // Data from monitor
    $scope.playerTime = [];  // Data from monitor
    $scope.loadedTime = [];  // Data from monitor
    $scope.playerDownloadingQuality = [];  // Data from monitor
    $scope.playerPlaybackQuality = [];  // Data from monitor
    $scope.playerPastDownloadingQuality = [];  // Data from monitor's playerDownloadingQuality
    $scope.playerCatchUp = [];  // Data from playback controller
    $scope.playerRTT = [];  // Data from monitor
    $scope.requestListLength = 0;  // Data from all HTTPRequests


    //// Global variables (private: only adjust in codes)

    $scope.IntervalOfSetNormalizedTime = 10;  // [For setting interval] Set the fastest mediaplayer's timeline as the normalized time
    $scope.IntervalOfComputetotalThroughput = 1000;  // [For setting interval] Compute total throughput according to recent HTTP requests
    $scope.IntervalOfComputeQoE = 1000;  // [For setting interval] Compute QoE
    $scope.IntervalOfUpdateRequestsCharts = 100;  // [For setting interval] Show the requests data in charts
    $scope.GET_SAMPLE_WINDOW_SIZE_FOR_RTT = 5;  // Set up the window size for calculating RTT


    //// Global variables (public: adjust by users)

    $scope.targetLatency = 10;  // The live delay allowed
    $scope.minDrift = 0.02;  // The minimal latency deviation allowed
    $scope.maxDrift = 3;  // The maximal latency deviation allowed
    $scope.catchupPlaybackRate = 0.5;  // Catchup playback rate
    $scope.liveCatchupLatencyThreshold = 60;  // Maximal latency allowed to catch up


    //// Global variables (stat & chart related)

    $scope.stats = [];  // Save all the stats need to put on the charts
    $scope.chartData_downloadingQuality = [];  // Save the downloading qualtiy data need to put on the charts
    $scope.chartData_playbackQuality = [];  // Save the playback qualtiy data need to put on the charts
    $scope.chartData_throughput = [];  // Save the throughput data need to put on the charts
    $scope.chartData_RTT = [];  // Save the RTT data need to put on the charts
    $scope.chartData_requests = [];  // Save the requests data need to put on the charts
    $scope.maxDownloadingQualityBuffer = [];  // Buffer for maximal chart data
    $scope.maxPlaybackQualityBuffer = [];  // Buffer for maximal chart data
    $scope.maxThroughputBuffer = [];  // Buffer for maximal chart data
    $scope.maxRTTBuffer = [];  // Buffer for maximal chart data
    $scope.maxDownloadingQuality = 0;  // Maximal chart data
    $scope.maxPlaybackQuality = 0;  // Maximal chart data
    $scope.maxThroughput = 0;  // Maximal chart data
    $scope.maxRTT = 0;  // Maximal chart data
    $scope.maxRequests = 0;  // Maximal chart data
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
                return $scope.convertToTimeCode(value);
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
                return $scope.convertToTimeCode(value);
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
                return $scope.convertToTimeCode(value);
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
                return $scope.convertToTimeCode(value);
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
            //     return $scope.convertToTimeCode(value);
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
    $scope.setStream = function (item, contentType, num) {
        if (contentType != undefined && num != undefined) {
            if (item.name == "COPY") {
                $scope.streamURLs[contentType][num] = $scope.streamURLs[contentType][0];
            } else if (item.name == "CUSTOM") {
                $scope.streamURLs[contentType][num] = "";
            } else {
                $scope.streamURLs[contentType][num] = item.url ? item.url : item.urls[contentType][num];
            }
        } else {
            if (item.name == "COPY") {
                for (let i = 0; i < $scope.streamNum.video; i++) {
                    $scope.streamURLs.video[i] = $scope.streamURLs.video[0];
                }
                for (let i = 0; i < $scope.streamNum.audio; i++) {
                    $scope.streamURLs.audio[i] = $scope.streamURLs.video[0];
                }
            } else if (item.name == "CUSTOM") {
                for (let i = 0; i < $scope.streamNum.video; i++) {
                    $scope.streamURLs.video[i] = "";
                }
                for (let i = 0; i < $scope.streamNum.audio; i++) {
                    $scope.streamURLs.audio[i] = "";
                }
            } else {
                if (item.url) {
                    for (let i = 0; i < $scope.streamNum.video; i++) {
                        $scope.streamURLs.video[i] = item.url;
                    }
                    for (let i = 0; i < $scope.streamNum.audio; i++) {
                        $scope.streamURLs.audio[i] = item.url;
                    }
                } else {
                    for (let i = 0; i < $scope.streamNum.video; i++) {
                        $scope.streamURLs.video[i] = item.urls.video[i];
                    }
                    for (let i = 0; i < $scope.streamNum.audio; i++) {
                        $scope.streamURLs.audio[i] = item.urls.audio[i];
                    }
                }
            }
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

    // Change the streaming mode
    $scope.changeMode = function (mode) {
        switch (mode) {
            case 'Multi-Path':
                $scope.selectedMode = 'Multi-Path';
                document.getElementById( "videoContainer" ).style.display = "block";
                $scope.changeABRStrategy('myBufferRule');
                break;
            default:
                break;
        }
    };

    // Change the number of streams
    $scope.changeStreamNumber = function (contentType) {
        while ($scope.streamURLs[contentType].length < $scope.streamNum[contentType]) {
            document.getElementById(contentType + 'Source_' + $scope.streamURLs[contentType].length).style = "display: block";
            $scope.streamURLs[contentType].push($scope.streamURLs.video[0]);
        }
        while ($scope.streamURLs[contentType].length > $scope.streamNum[contentType]) {
            document.getElementById(contentType + 'Source_' + ($scope.streamURLs[contentType].length - 1)).style = "display: none";
            $scope.streamURLs[contentType].pop();
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
    };

    // Initializing & clearing the charts
    $scope.initChartingByMediaType = function (id, type) {
        switch(type) {
            // case "downloadingQuality":
            //     var data = {
            //         id: id,
            //         data: $scope.chartState[type][id].data,
            //         label: $scope.chartState[type][id].label,
            //         color: $scope.chartState[type][id].color,
            //         type: type
            //     };
            //     $scope.chartData_downloadingQuality.push(data);
            //     break;
            // case "playbackQuality":
            //     var data = {
            //         id: id,
            //         data: $scope.chartState[type][id].data,
            //         label: $scope.chartState[type][id].label,
            //         color: $scope.chartState[type][id].color,
            //         type: type
            //     };
            //     $scope.chartData_playbackQuality.push(data);
            //     break;
            case "bufferLevel":
                var data = {
                    id: id,
                    data: $scope.chartState[type][id].data,
                    label: $scope.chartState[type][id].label,
                    color: $scope.chartState[type][id].color,
                    type: type
                };
                $scope.chartData_bufferLevel.push(data);
                break;
            // case "throughput":
            //     var data = {
            //         id: id,
            //         data: $scope.chartState[type][id].data,
            //         label: $scope.chartState[type][id].label,
            //         color: $scope.chartState[type][id].color,
            //         type: type
            //     };
            //     $scope.chartData_throughput.push(data);
            //     break;
            // case "RTT":
            //     var data = {
            //         id: id,
            //         data: $scope.chartState[type][id].data,
            //         label: $scope.chartState[type][id].label,
            //         color: $scope.chartState[type][id].color,
            //         type: type
            //     };
            //     $scope.chartData_RTT.push(data);
            //     break;
            // case "requests":
            //     var data = {
            //         id: id,
            //         data: $scope.chartState[type][id].data,
            //         label: $scope.chartState[type][id].label,
            //         color: $scope.chartState[type][id].color,
            //         type: type
            //     };
            //     $scope.chartData_requests.push(data);
            //     break;
        }
        // $scope.chartOptions_downloadingQuality.legend.noColumns = Math.min($scope.chartData_downloadingQuality.length, 7);
        // $scope.chartOptions_playbackQuality.legend.noColumns = Math.min($scope.chartData_playbackQuality.length, 7);
        $scope.chartOptions_bufferLevel.legend.noColumns = Math.min($scope.chartData_bufferLevel.length, 7);
        // $scope.chartOptions_throughput.legend.noColumns = Math.min($scope.chartData_throughput.length, 7);
        // $scope.chartOptions_RTT.legend.noColumns = Math.min($scope.chartData_RTT.length, 7);
        // $scope.chartOptions_requests.legend.noColumns = Math.min($scope.chartData_requests.length, 7);
    };
    $scope.clearchartData = function () {
        // $scope.maxDownloadingQualityBuffer = [];
        // $scope.maxPlaybackQualityBuffer = [];
        $scope.maxBufferLevelBuffer = [];
        // $scope.maxThroughputBuffer = [];
        // $scope.maxRTTBuffer = [];
        // $scope.maxDownloadingQuality = 0;
        // $scope.maxPlaybackQuality = 0;
        $scope.maxBufferLevel = 0;
        // $scope.maxThroughput = 0;
        // $scope.maxRTT = 0;
        // $scope.maxRequests = 0;
        for (var key in $scope.chartState) {
            for (var i in $scope.chartState[key]) {
                $scope.chartState[key][i].data.length = 0;
            }
        }
    };

    // Plotting data in charts
    $scope.updateCharts = function () {
        let time = $scope.getTimeForPlot();

        if ($scope.streamSourceBuffer["video"]) {
            $scope.monitorBufferLevel.video = $scope.getBufferLevel("video");
        }
        if ($scope.streamSourceBuffer["audio"]) {
            $scope.monitorBufferLevel.audio = $scope.getBufferLevel("audio");
        }

        // $scope.maxDownloadingQualityBuffer.push($scope.playerDownloadingQuality.reduce((a, b) => a > b ? a : b));
        // $scope.maxPlaybackQualityBuffer.push($scope.playerPlaybackQuality.reduce((a, b) => a > b ? a : b));
        $scope.maxBufferLevelBuffer.push(($scope.monitorBufferLevel.video > $scope.monitorBufferLevel.audio ? $scope.monitorBufferLevel.video : $scope.monitorBufferLevel.audio) || $scope.monitorBufferLevel.video || $scope.monitorBufferLevel.audio || 0);
        // $scope.maxThroughputBuffer.push($scope.playerAverageThroughput.reduce((a, b) => a > b ? a : b));
        // $scope.maxRTTBuffer.push($scope.playerRTT.reduce((a, b) => a > b ? a : b));
        // if ($scope.maxDownloadingQualityBuffer.length > $scope.maxPointsToChart) {
        //     $scope.maxDownloadingQualityBuffer.shift();
        // }
        // if ($scope.maxPlaybackQualityBuffer.length > $scope.maxPointsToChart) {
        //     $scope.maxPlaybackQualityBuffer.shift();
        // }
        if ($scope.maxBufferLevelBuffer.length > $scope.maxPointsToChart) {
            $scope.maxBufferLevelBuffer.shift();
        }
        // if ($scope.maxThroughputBuffer.length > $scope.maxPointsToChart) {
        //     $scope.maxThroughputBuffer.shift();
        // }
        // if ($scope.maxRTTBuffer.length > $scope.maxPointsToChart) {
        //     $scope.maxRTTBuffer.shift();
        // }
        // $scope.maxDownloadingQuality = $scope.maxDownloadingQualityBuffer.reduce((a, b) => a > b ? a : b);
        // $scope.maxPlaybackQuality = $scope.maxPlaybackQualityBuffer.reduce((a, b) => a > b ? a : b);
        $scope.maxBufferLevel = $scope.maxBufferLevelBuffer.reduce((a, b) => a > b ? a : b);
        // $scope.maxThroughput = $scope.maxThroughputBuffer.reduce((a, b) => a > b ? a : b);
        // $scope.maxRTT = $scope.maxRTTBuffer.reduce((a, b) => a > b ? a : b);
        // $scope.chartOptions_downloadingQuality.yaxis.max = $scope.maxDownloadingQuality;
        // $scope.chartOptions_playbackQuality.yaxis.max = $scope.maxPlaybackQuality;
        $scope.chartOptions_bufferLevel.yaxis.max = $scope.maxBufferLevel;
        // $scope.chartOptions_throughput.yaxis.max = $scope.maxThroughput / 1000;
        // $scope.chartOptions_RTT.yaxis.max = $scope.maxRTT;
        if ($scope.streamSourceBuffer.video) {
            $scope.plotPoint("video", 'bufferLevel', $scope.monitorBufferLevel.video, time);
        }
        if ($scope.streamSourceBuffer.audio) {
            $scope.plotPoint("audio", 'bufferLevel', $scope.monitorBufferLevel.audio, time);
        }
    };
    $scope.updateRequestsCharts = function () {
        if ($scope.requestList.length > $scope.requestListLength) {
            // $scope.maxRequests = $scope.requestList.reduce((a, b) => a.request._quality > b ? a.request._quality : b);
            // $scope.chartOptions_requests.yaxis.max = $scope.maxRequests;
            $scope.plotPoint($scope.requestList[$scope.requestListLength].count == $scope.playerNum ? "audio" : "video_" + $scope.requestList[$scope.requestListLength].count, 'requests', $scope.requestList[$scope.requestListLength].request._quality, $scope.requestList[$scope.requestListLength].request.mediaStartTime);
            $scope.requestListLength++;
        } else if ($scope.requestList.length < $scope.requestListLength) {
            console.log("RequestList charts wrong!")
        }
    };
    $scope.getTimeForPlot = function () {
        let now = new Date().getTime() / 1000  + $scope.clientServerTimeShift;
        return Math.max(now - ($scope.startupTime.getTime() / 1000), 0);
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


/////////////////////////////////////////////////////////////////////////////////////

    //// Functions: media players

    // Loading streams
    $scope.loadStream = function() {

        document.getElementById("Load").style.display = "none";
        document.getElementById("Reload").style.display = "inline-block";
        document.getElementById("MultiPathMode").disabled = "true";
        switch ($scope.selectedMode) {
            case 'Multi-Path':
                $scope.mse_init();
                break;
            default:
                break;
        }

    };

    // Reloading streams
    $scope.reloadStream = function() {

        for (let i = 0; i < $scope.intervalFunctions.length; i++) {
            clearInterval($scope.intervalFunctions[i]);
        }
        $scope.intervalFunctions = [];

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
        $scope.streamBitrateLists = {
            video: [],
            audio: []
        };
        $scope.requestList = [];

        $scope.streamInfo = {
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
        $scope.streamSourceBufferMimeCodecs = {
            video: NaN,
            audio: NaN
        };

        $scope.streamDuration = NaN;
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

        if ($scope.streamSourceBuffer["video"]) {
            $scope.streamSourceBuffer["video"].removeEventListener($scope.EVENT_UPDATE_END, $scope.appendBuffer);
            $scope.streamSourceBuffer["video"].removeEventListener($scope.EVENT_UPDATE_END, $scope.onBufferLevelUpdated);
            $scope.mediaSource.removeSourceBuffer($scope.streamSourceBuffer["video"]);
        }
        if ($scope.streamSourceBuffer["audio"]) {
            $scope.streamSourceBuffer["audio"].removeEventListener($scope.EVENT_UPDATE_END, $scope.appendBuffer);
            $scope.streamSourceBuffer["audio"].removeEventListener($scope.EVENT_UPDATE_END, $scope.onBufferLevelUpdated);
            $scope.mediaSource.removeSourceBuffer($scope.streamSourceBuffer["audio"]);
        }
        $scope.streamSourceBuffer = {
            video: null,
            audio: null
        };

        if ($scope.controllBar) {
            $scope.streamElement.removeEventListener($scope.EVENT_TIME_UPDATE, $scope.controllBar.onPlaybackTimeUpdate);
        }
        $scope.streamElement.src = "";
        $scope.streamElement = null;

        $scope.mediaSource.removeEventListener('sourceopen', $scope.sourceOpen);
        // $scope.mediaSource.endOfStream();
        $scope.mediaSource = null;

        $scope.controllBar.destroy();
        $scope.controllBar = null;

        $scope.clearchartData();
        
        $scope.mse_init();

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
        $scope.mediaSource.addEventListener('sourceopen', $scope.sourceOpen());

    };

    // Checking paths of videos/audios
    $scope.checkPaths = function() {

        if (!($scope.streamNum.video || $scope.streamNum.audio)) {
            window.alert("Wrong streamNum.video/streamNum.audio: At least one path for fetching media!");
            return false;
        }

        for (let i = 0; i < $scope.streamNum.video; i++) {
            if (!$scope.streamURLs.video[i] || $scope.streamURLs.video[i] == "") {
                window.alert("Wrong streamURLs.video[" + i + "]: Empty URL in a path of video!");
                return false;
            }
            if (!$scope.streamURLs.video[i] || $scope.streamURLs.video[i].slice(-4) !== ".mpd") {
                window.alert("Wrong streamURLs.video[" + i + "]: Not a .mpd URL in a path of video!");
                return false;
            }
        }

        for (let i = 0; i < $scope.streamNum.audio; i++) {
            if (!$scope.streamURLs.audio[i] || $scope.streamURLs.audio[i] == "") {
                window.alert("Wrong streamURLs.audio[" + i + "]: Empty URL in a path of audio!");
                return false;
            }
            if (!$scope.streamURLs.audio[i] || $scope.streamURLs.audio[i].slice(-4) !== ".mpd") {
                window.alert("Wrong streamURLs.audio[" + i + "]: Not a .mpd URL in a path of audio!");
                return false;
            }
        }

        return true;

    };

    // Triggered when mediaSoure is ready to open sources
    $scope.sourceOpen = function() {

        setTimeout(() => {
            for (let i = 0; i < $scope.streamNum.video; i++) {
                $scope.fetchMpd($scope.streamURLs.video[i], (response, requestTime) => {
                    $scope.requestList.push({
                        urlType: $scope.TYPE_OF_MPD,
                        contentType: "video",
                        pathIndex: i,
                        periodIndex: "-",
                        adaptationSetIndex: "-",
                        representationIndex: "-",
                        segmentIndex: "-",
                        trequest: requestTime.trequest.getTime(),
                        tresponse: requestTime.tresponse.getTime(),
                        tfinish: requestTime.tfinish.getTime() 
                    });
                    $scope.loadMpd(response, "video", i);
                });
            }
    
            for (let i = 0; i < $scope.streamNum.audio; i++) {
                $scope.fetchMpd($scope.streamURLs.audio[i], (response, requestTime) => {
                    $scope.requestList.push({
                        urlType: $scope.TYPE_OF_MPD,
                        contentType: "audio",
                        pathIndex: i,
                        periodIndex: "-",
                        adaptationSetIndex: "-",
                        representationIndex: "-",
                        segmentIndex: "-",
                        trequest: requestTime.trequest.getTime(),
                        tresponse: requestTime.tresponse.getTime(),
                        tfinish: requestTime.tfinish.getTime() 
                    });
                    $scope.loadMpd(response, "audio", i);
                });
            }

            // Add event listeners:  update playback time
            $scope.streamElement.addEventListener($scope.EVENT_TIME_UPDATE, $scope.onPlaybackTimeUpdate);

            // Add interval function: append buffers in intervals
            $scope.intervalFunctions.push(setInterval($scope.appendBuffer, $scope.INTERVAL_OF_APPEND_BUFFER));

            // Add interval function: update charts
            $scope.intervalFunctions.push(setInterval($scope.updateCharts, $scope.INTERVAL_OF_UPDATE_CHARTS));

        }, $scope.TIMEOUT_OF_SOURCE_OPEN);

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

        var baseUrl = $scope.resolveUrl($scope.TYPE_OF_MPD, $scope.streamURLs[contentType][i]);
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
                $scope.intervalFunctions.push(setInterval($scope.scheduleFetcher.bind(this, contentType), $scope.INTERVAL_OF_SCHEDULE_FETCHER));
            }

            // Create and initialize control bar
            if (!$scope.controllBar) {
                $scope.controllBar = new ControlBar();
                $scope.controllBar.initialize();
                $scope.controllBar.destroyAllMenus();
            }
            // Create and add track/bitrate/caption lists into control bar
            $scope.controllBar.onStreamActivated(contentType, i);
        } catch (e) {
            window.alert("Error when registerring " + contentType + " " + i + (e == "" ? e : ": " + e));
        }
    
    };

    // Fetch the segments periodly if isFetchingSegment is false
    $scope.scheduleFetcher = function(contentType) {
        var bufferLevel = $scope.getBufferLevel(contentType);
        if (!$scope.isSeeking && !$scope.isFetchingSegment[contentType] && !isNaN(bufferLevel) && bufferLevel < $scope.targetBuffer
                && !isNaN($scope.streamBitrateLists[contentType][$scope.streamInfo[contentType].pathIndex][$scope.streamInfo[contentType].periodIndex][$scope.streamInfo[contentType].adaptationSetIndex][$scope.streamInfo[contentType].representationIndex].segmentNum) 
                && $scope.streamInfo[contentType].segmentIndex <= $scope.streamBitrateLists[contentType][$scope.streamInfo[contentType].pathIndex][$scope.streamInfo[contentType].periodIndex][$scope.streamInfo[contentType].adaptationSetIndex][$scope.streamInfo[contentType].representationIndex].segmentNum) {
            // Adjust the streamInfo by ABR rules
            if ($scope.autoSwitchBitrate[contentType] && $scope.autoSwitchTrack[contentType] && $scope.abrRules.hasOwnProperty($scope.selectedRule)) {
                $scope.streamInfo[contentType] = $scope.abrRules[$scope.selectedRule].setStreamInfo($scope.streamInfo[contentType], contentType);
            }
            // Fetch InitSegment and MediaSegment
            if ($scope.initCache[contentType][$scope.streamInfo[contentType].pathIndex][$scope.streamInfo[contentType].periodIndex][$scope.streamInfo[contentType].adaptationSetIndex][$scope.streamInfo[contentType].representationIndex]) {
                $scope.fetchSegment(contentType, $scope.TYPE_OF_MEDIA_SEGMENT);
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
                    if (manifest.Period[j].AdaptationSet[jj].contentType == contentType || (manifest.Period[j].AdaptationSet[jj].Representation != undefined && manifest.Period[j].AdaptationSet[jj].Representation[0].mimeType != undefined && manifest.Period[j].AdaptationSet[jj].Representation[0].mimeType.slice(0, 5) == contentType)) {
                        $scope.streamBitrateLists[contentType][i][j][jj] = [];
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
                                    $scope.streamBitrateLists[contentType][i][j][jj][jjj] = {
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
                                    };
                                    // Get segmentNum
                                    // Type 1: $Number$
                                    if (!isNaN($scope.streamBitrateLists[contentType][i][j][jj][jjj].duration) && !isNaN($scope.streamBitrateLists[contentType][i][j][jj][jjj].timescale)) {
                                        if (!isNaN(manifest.Period[j].duration)) {
                                            $scope.streamBitrateLists[contentType][i][j][jj][jjj].segmentNum = Math.ceil(manifest.Period[j].duration / ($scope.streamBitrateLists[contentType][i][j][jj][jjj].duration / $scope.streamBitrateLists[contentType][i][j][jj][jjj].timescale));
                                        } else if (!isNaN(manifest.Period[j].start)) {
                                            let end = manifest.mediaPresentationDuration;
                                            for (let k = 0; k < manifest.Period.length; k++) {
                                                if (manifest.Period[k].start > manifest.Period[j].start && manifest.Period[k].start < end) {
                                                    end = manifest.Period[k].start;
                                                }
                                            }
                                            $scope.streamBitrateLists[contentType][i][j][jj][jjj].segmentNum = Math.ceil((end - manifest.Period[j].start) / ($scope.streamBitrateLists[contentType][i][j][jj][jjj].duration / $scope.streamBitrateLists[contentType][i][j][jj][jjj].timescale));
                                        } else {
                                            if (manifest.Period.length == 1) {
                                                $scope.streamBitrateLists[contentType][i][j][jj][jjj].segmentNum = Math.ceil(manifest.mediaPresentationDuration / ($scope.streamBitrateLists[contentType][i][j][jj][jjj].duration / $scope.streamBitrateLists[contentType][i][j][jj][jjj].timescale));
                                            } else {
                                                // TODO
                                            }
                                        }
                                    }
                                    // Type 2: $Time$
                                    else if (!isNaN($scope.streamBitrateLists[contentType][i][j][jj][jjj].r) && $scope.streamBitrateLists[contentType][i][j][jj][jjj].r != -1) {
                                        $scope.streamBitrateLists[contentType][i][j][jj][jjj].segmentNum = $scope.streamBitrateLists[contentType][i][j][jj][jjj].r;
                                    }
                                    else if (!isNaN($scope.streamBitrateLists[contentType][i][j][jj][jjj].d) && !isNaN($scope.streamBitrateLists[contentType][i][j][jj][jjj].timescale)) {
                                        if (!isNaN(manifest.Period[j].duration)) {
                                            $scope.streamBitrateLists[contentType][i][j][jj][jjj].segmentNum = Math.ceil(manifest.Period[j].duration / ($scope.streamBitrateLists[contentType][i][j][jj][jjj].d / $scope.streamBitrateLists[contentType][i][j][jj][jjj].timescale));
                                        } else if (!isNaN(manifest.Period[j].start)) {
                                            let end = manifest.mediaPresentationDuration;
                                            for (let k = 0; k < manifest.Period.length; k++) {
                                                if (manifest.Period[k].start > manifest.Period[j].start && manifest.Period[k].start < end) {
                                                    end = manifest.Period[k].start;
                                                }
                                            }
                                            $scope.streamBitrateLists[contentType][i][j][jj][jjj].segmentNum = Math.ceil((end - manifest.Period[j].start) / ($scope.streamBitrateLists[contentType][i][j][jj][jjj].d / $scope.streamBitrateLists[contentType][i][j][jj][jjj].timescale));
                                        } else {
                                            if (manifest.Period.length == 1) {
                                                $scope.streamBitrateLists[contentType][i][j][jj][jjj].segmentNum = Math.ceil(manifest.mediaPresentationDuration / ($scope.streamBitrateLists[contentType][i][j][jj][jjj].d / $scope.streamBitrateLists[contentType][i][j][jj][jjj].timescale));
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
            return "SUCCESS";
        } catch (e) {
            return "registerBitrateLists: " + e;
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
                                if ($scope.streamBitrateLists[contentType][i][j][jj][secondsmall.key].mimeCodecs) {
                                    curStreamInfo.representationIndex = secondsmall.key;
                                    // segmentIndex
                                    curStreamInfo.segmentIndex = !isNaN($scope.streamBitrateLists[contentType][i][j][jj][secondsmall.key].startNumber) ? $scope.streamBitrateLists[contentType][i][j][jj][secondsmall.key].startNumber : 1;
                                    // lastSegmentIndex
                                    curStreamInfo.lastSegmentIndex = NaN;
                                    // mimeCodecs
                                    curStreamInfo.mimeCodecs = $scope.streamBitrateLists[contentType][i][j][jj][secondsmall.key].mimeCodecs;
                                    break;
                                }
                            } else if (firstsmall) {
                                if ($scope.streamBitrateLists[contentType][i][j][jj][firstsmall.key].mimeCodecs) {
                                    curStreamInfo.representationIndex = firstsmall.key;
                                    // segmentIndex
                                    curStreamInfo.segmentIndex = !isNaN($scope.streamBitrateLists[contentType][i][j][jj][firstsmall.key].startNumber) ? $scope.streamBitrateLists[contentType][i][j][jj][firstsmall.key].startNumber : 1;
                                    // lastSegmentIndex
                                    curStreamInfo.lastSegmentIndex = NaN;
                                    // mimeCodecs
                                    curStreamInfo.mimeCodecs = $scope.streamBitrateLists[contentType][i][j][jj][firstsmall.key].mimeCodecs;
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

            if ($scope.streamSourceBuffer[contentType]) {
                throw "The registeration of path " + i + " is aborted by the existing SourceBuffer!";
            }

            // Initialize settings and parameters
            $scope.streamInfo[contentType] = curStreamInfo;
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

            // Create SourceBuffer
            try {
                $scope.streamSourceBuffer[contentType] = $scope.mediaSource.addSourceBuffer(curStreamInfo.mimeCodecs);
                $scope.mediaSource.duration = $scope.streamDuration;
            } catch (e) {
                throw "SourceBuffer is not initialized: " + e;
            }

            // Set the startup time of the player
            $scope.startupTime = new Date(parseInt(new Date().getTime() + $scope.clientServerTimeShift * 1000));
            $scope.startupTimeFormatted = $scope.startupTime.toLocaleString();

            // Add event listeners:  1. append buffers from listeners   2. update buffer levels
            $scope.streamSourceBuffer[contentType].addEventListener($scope.EVENT_UPDATE_END, $scope.appendBuffer);
            $scope.streamSourceBuffer[contentType].addEventListener($scope.EVENT_UPDATE_END, $scope.onBufferLevelUpdated);

            // Initialize charts
            $scope.chartState["bufferLevel"][contentType] = {
                data: [],
                color: $scope.chartColor[contentType == "video" ? 0 : 1],
                label: contentType
            };
            $scope.initChartingByMediaType(contentType, "bufferLevel");

            return "SUCCESS";
        } catch (e) {
            return "registerFirstStreamInfo: " + e;
        }

    };

    $scope.onBufferLevelUpdated = function () {
        if ($scope.controllBar && $scope.controllBar.onBufferLevelUpdated) {
            $scope.controllBar.onBufferLevelUpdated();
        }
    };

    $scope.onPlaybackTimeUpdate = function () {
        if ($scope.controllBar && $scope.controllBar.onPlaybackTimeUpdate) {
            $scope.controllBar.onPlaybackTimeUpdate();
        }
    }

    // Run when the segment need to be fetched from servers
    $scope.fetchSegment = function(contentType, urlType) {

        var curStreamInfo = {
            pathIndex: $scope.streamInfo[contentType].pathIndex,
            periodIndex: $scope.streamInfo[contentType].periodIndex,
            adaptationSetIndex: $scope.streamInfo[contentType].adaptationSetIndex,
            representationIndex: $scope.streamInfo[contentType].representationIndex,
            segmentIndex: $scope.streamInfo[contentType].segmentIndex,
            baseUrl: $scope.streamInfo[contentType].baseUrl,
            mimeCodecs: $scope.streamInfo[contentType].mimeCodecs,
            lastSegmentIndex: $scope.streamInfo[contentType].mimeCodecs
        };
        if (urlType == $scope.TYPE_OF_INIT_SEGMENT && $scope.initCache[contentType][curStreamInfo.pathIndex][curStreamInfo.periodIndex][curStreamInfo.adaptationSetIndex][curStreamInfo.representationIndex]) {
            console.log("Init segment of " + contentType + " " + curStreamInfo.pathIndex + " period " + curStreamInfo.periodIndex + " adaptationSet " + curStreamInfo.adaptationSetIndex + " representation " + curStreamInfo.representationIndex + " is in the initCache!");
            // $scope.streamBufferToAppend[contentType].push($scope.initCache[contentType][curStreamInfo.pathIndex][curStreamInfo.periodIndex][curStreamInfo.adaptationSetIndex][curStreamInfo.representationIndex]);
            return;
        }
        var paramForResolveUrl = {
            id: $scope.streamBitrateLists[contentType][curStreamInfo.pathIndex][curStreamInfo.periodIndex][curStreamInfo.adaptationSetIndex][curStreamInfo.representationIndex].id,
            t: $scope.streamBitrateLists[contentType][curStreamInfo.pathIndex][curStreamInfo.periodIndex][curStreamInfo.adaptationSetIndex][curStreamInfo.representationIndex].t,
            d: $scope.streamBitrateLists[contentType][curStreamInfo.pathIndex][curStreamInfo.periodIndex][curStreamInfo.adaptationSetIndex][curStreamInfo.representationIndex].d,
            segmentIndex: curStreamInfo.segmentIndex
        };
        var url = curStreamInfo.baseUrl;
        var urlExtend = urlType == $scope.TYPE_OF_INIT_SEGMENT ? $scope.streamBitrateLists[contentType][curStreamInfo.pathIndex][curStreamInfo.periodIndex][curStreamInfo.adaptationSetIndex][curStreamInfo.representationIndex].initialization : urlType == $scope.TYPE_OF_MEDIA_SEGMENT ? $scope.streamBitrateLists[contentType][curStreamInfo.pathIndex][curStreamInfo.periodIndex][curStreamInfo.adaptationSetIndex][curStreamInfo.representationIndex].media : "";
        var urlResolved = $scope.resolveUrl(urlType, url, urlExtend, paramForResolveUrl);
        $scope.isFetchingSegment[contentType] = true;
        console.log("Fetching " + urlType + ": Type " + contentType + ", Path " + curStreamInfo.pathIndex + ", Period " + curStreamInfo.periodIndex + ", AdaptationSet " + curStreamInfo.adaptationSetIndex + ", Representation " + curStreamInfo.representationIndex + (urlType == $scope.TYPE_OF_MEDIA_SEGMENT ? ", Segment " + curStreamInfo.segmentIndex + "." : "."));
        $scope.fetchBuffer(urlResolved, $scope.RESPONSE_TYPE_OF_SEGMENT, 
            (buffer, requestTime) => {
                $scope.requestList.push({
                    urlType: urlType,
                    contentType: contentType,
                    pathIndex: curStreamInfo.pathIndex,
                    periodIndex: curStreamInfo.periodIndex,
                    adaptationSetIndex: curStreamInfo.adaptationSetIndex,
                    representationIndex: curStreamInfo.representationIndex,
                    segmentIndex: curStreamInfo.segmentIndex,
                    trequest: requestTime.trequest.getTime(),
                    tresponse: requestTime.tresponse.getTime(),
                    tfinish: requestTime.tfinish.getTime()                    
                });
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

        $scope.streamBufferToAppend[contentType].push({
            content: buffer,
            mimeCodecs: curStreamInfo.mimeCodecs
        });
        if (urlType == $scope.TYPE_OF_INIT_SEGMENT) {  // Save in the cache if InitSegment
            $scope.initCache[contentType][curStreamInfo.pathIndex][curStreamInfo.periodIndex][curStreamInfo.adaptationSetIndex][curStreamInfo.representationIndex] = {
                content: buffer,
                mimeCodecs: curStreamInfo.mimeCodecs
            };
        } else if (urlType == $scope.TYPE_OF_MEDIA_SEGMENT) {    // Add buffered time if MediaSegment
            $scope.streamInfo[contentType].lastSegmentIndex = $scope.streamInfo[contentType].segmentIndex;
            $scope.streamInfo[contentType].segmentIndex++;
            // Judge if continue, jump into the next period or end the stream
            if ($scope.streamInfo[contentType].segmentIndex > $scope.streamBitrateLists[contentType][$scope.streamInfo[contentType].pathIndex][$scope.streamInfo[contentType].periodIndex][$scope.streamInfo[contentType].adaptationSetIndex][$scope.streamInfo[contentType].representationIndex].segmentNum + $scope.streamBitrateLists[contentType][$scope.streamInfo[contentType].pathIndex][$scope.streamInfo[contentType].periodIndex][$scope.streamInfo[contentType].adaptationSetIndex][$scope.streamInfo[contentType].representationIndex].startNumber - 1) {
                let curPeriodIndex = $scope.streamInfo[contentType].periodIndex;
                let periodEnd = {
                    value: $scope.streamMpds[contentType][$scope.streamInfo[contentType].pathIndex].mediaPresentationDuration,
                    index: -1
                };
                for (let i = 0; i < $scope.streamMpds[contentType][$scope.streamInfo[contentType].pathIndex].Period.length; i++) {
                    if ($scope.streamMpds[contentType][$scope.streamInfo[contentType].pathIndex].Period[i].start != undefined && $scope.streamMpds[contentType][$scope.streamInfo[contentType].pathIndex].Period[i].start > $scope.streamMpds[contentType][$scope.streamInfo[contentType].pathIndex].Period[curPeriodIndex].start && $scope.streamMpds[contentType][$scope.streamInfo[contentType].pathIndex].Period[i].start < periodEnd.value) {
                        periodEnd.value = $scope.streamMpds[contentType][$scope.streamInfo[contentType].pathIndex].Period[i].start;
                        periodEnd.index = i;
                    } else if ($scope.streamMpds[contentType][$scope.streamInfo[contentType].pathIndex].Period[i].id != undefined && $scope.streamMpds[contentType][$scope.streamInfo[contentType].pathIndex].Period[i].id == $scope.streamMpds[contentType][$scope.streamInfo[contentType].pathIndex].Period[curPeriodIndex].id + 1) {
                        periodEnd.index = i;
                    }
                }
                if (periodEnd.index != -1) {
                    $scope.streamInfo[contentType].periodIndex = periodEnd.index;
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

    // Periodly check and append buffers, or triggered when updateend event happens
    $scope.appendBuffer = function() {
        if ($scope.streamSourceBuffer['video'] && !$scope.streamSourceBuffer['video'].updating && $scope.streamBufferToAppend['video'].length > 0) {
            let buffer = $scope.streamBufferToAppend['video'].shift();
            if ($scope.streamSourceBufferMimeCodecs['video'] != buffer.mimeCodecs) {
                $scope.streamSourceBuffer['video'].changeType(buffer.mimeCodecs);
            }
            $scope.streamSourceBufferMimeCodecs['video'] = buffer.mimeCodecs;
            $scope.streamSourceBuffer['video'].appendBuffer(buffer.content);
        }
        if ($scope.streamSourceBuffer['audio'] && !$scope.streamSourceBuffer['audio'].updating && $scope.streamBufferToAppend['audio'].length > 0) {
            let buffer = $scope.streamBufferToAppend['audio'].shift();
            if ($scope.streamSourceBufferMimeCodecs['audio'] != buffer.mimeCodecs) {
                $scope.streamSourceBuffer['audio'].changeType(buffer.mimeCodecs);
            }
            $scope.streamSourceBufferMimeCodecs['audio'] = buffer.mimeCodecs;
            $scope.streamSourceBuffer['audio'].appendBuffer(buffer.content);
        }
    }

    // Create and load a XMLHttpRequest
    $scope.fetchBuffer = function(url, responseType, callback, noFile) {

        if (!url) {
            window.alert("The URL is invalid: " + url);
            return;
        }

        var requestTime = {
            trequest: null,
            tresponse: null,
            tfinish: null
        };
        var firstByteReceived = false;

        var xhr = new XMLHttpRequest();
        xhr.open($scope.HTTP_REQUEST_METHOD, url);
        xhr.responseType = responseType;  // 'text', 'arraybuffer'
        xhr.onload = function () {
            if (xhr.status == 200) {
                requestTime.tfinish = new Date();
                callback(xhr.response, requestTime);
            }
        };
        xhr.onreadystatechange = function () {
            if (noFile && xhr.status == 404) {
                noFile(xhr.status);
                xhr.onreadystatechange = null;
            }
        };
        xhr.onprogress = function () {
            if (!firstByteReceived) {
                requestTime.tresponse = new Date();
                firstByteReceived = true;
            }
        }
        requestTime.trequest = new Date();
        xhr.send();

    };

    $scope.convertToTimeCode = function (value) {
        value = Math.max(value, 0);

        let h = Math.floor(value / 3600);
        let m = Math.floor((value % 3600) / 60);
        let s = Math.floor((value % 3600) % 60);
        return (h === 0 ? '' : (h < 10 ? '0' + h.toString() + ':' : h.toString() + ':')) + (m < 10 ? '0' + m.toString() : m.toString()) + ':' + (s < 10 ? '0' + s.toString() : s.toString());
    };

/////////////////////////////////////////////////////////////////////////////////////


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

    };

    // Compute QoE
    $scope.computeQoE = function() {

    };

    // Show the data in monitor
    $scope.updateStats = function() {
        $scope.stats.splice(0, $scope.stats.length);
        for (let i = 0; i <= $scope.playerNum; i++) {
            if ($scope.players[i]) {
                // Calculate bufferLength, averageThroughput, timeline, loadedTimeline and downloadingQuality for each path by APIs
                $scope.monitorBufferLevel[i] = $scope.players[i].getBufferLength(i == $scope.playerNum ? "audio" : "video");
                $scope.monitorBufferLevel[i] = $scope.monitorBufferLevel[i] > 0 ? $scope.monitorBufferLevel[i] : 0;
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
                    bufferlevel : $scope.monitorBufferLevel[i].toFixed(2) + " s",
                    throughput : ($scope.playerAverageThroughput[i] / 1000).toFixed(0)+ " kbps",
                    time : $scope.playerTime[i].toFixed(2) + " s",
                    loadedtime : $scope.loadedTime[i].toFixed(2) + " s",
                    downloadingQuality : $scope.playerDownloadingQuality[i].toFixed(0),
                    playbackQuality: $scope.playerPlaybackQuality[i].toFixed(0),
                    totaltime : ($scope.monitorBufferLevel[i] + $scope.playerTime[i]).toFixed(2) + " s",
                    playerCatchUp : ($scope.playerCatchUp[i] ? "Catching up" : "Synchronizing"),
                    playerRTT : $scope.playerRTT[i].toFixed(1) + " ms"
                });
            }
        }
    };

    // Other platform intervals
    setInterval(() => {
        $scope.UTCTime = new Date(parseInt(new Date().getTime() + $scope.clientServerTimeShift * 1000)).toLocaleString();
    }, $scope.INTERVAL_OF_PLATFORM_ADJUSTMENT);

}]);