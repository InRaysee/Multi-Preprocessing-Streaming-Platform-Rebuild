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

    $scope.streamDuration = NaN;  // Total duration of the VOD stream
    $scope.streamStartTime = NaN;  // Availability start time of the live stream
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
    $scope.startupTime = 0;  // Startup time of streaming
    $scope.startupTimeFormatted = null;  // Formatted startup time of streaming

    // $scope.clientServerTimeShift = 0;  // Time shift between client and server from TimelineConverter
    // $scope.normalizedTime = NaN;  // Set the fastest mediaplayer's timeline as the normalized time
    // $scope.totalThroughput = NaN;  // Compute the total throughput considering all players
    // $scope.totalQOE = NaN;  // Compute the QoE considering all players (TODO)


/////////////////////////////////////////////////////////////////////////////////////
/*                Global variables (private: only adjust in codes)                 */
/////////////////////////////////////////////////////////////////////////////////////

    $scope.CONTENT_TYPE = ["video", "audio"];
    $scope.INTERVAL_OF_PLATFORM_ADJUSTMENT = 10;
    $scope.INTERVAL_OF_UPDATE_CHARTS = 500;
    $scope.INTERVAL_OF_APPEND_BUFFER = 10;
    $scope.INTERVAL_OF_LIFE_SIGNAL_FETCHER = 5000;
    $scope.TIMEOUT_OF_SOURCE_OPEN = 1;
    $scope.TIMEOUT_OF_ADD_SOURCEBUFFER = 1;
    $scope.AVERAGE_THROUGHPUT_WINDOW = 5;
    $scope.LEGEND_COLUMN_LENGTH = 10;
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
        rttThroughputRule: new RttThroughputRuleClass(),
        rttBufferRule: new RttBufferRuleClass(),
        highestBitrateRule: new HighestBitrateRuleClass(),
        lowestBitrateRule: new LowestBitrateRuleClass(),
        globalSwitchRule: new GlobalSwitchRuleClass()
    };

    // $scope.IntervalOfSetNormalizedTime = 10;  // [For setting interval] Set the fastest mediaplayer's timeline as the normalized time
    // $scope.IntervalOfComputetotalThroughput = 1000;  // [For setting interval] Compute total throughput according to recent HTTP requests
    // $scope.IntervalOfComputeQoE = 1000;  // [For setting interval] Compute QoE


/////////////////////////////////////////////////////////////////////////////////////
/*                   Global variables (public: adjust by users)                    */
/////////////////////////////////////////////////////////////////////////////////////

    $scope.INTERVAL_OF_SCHEDULE_FETCHER = 50;
    $scope.targetBuffer = 2;  // The buffer level desired to be fetched
    $scope.streamNum = {  // Number of paths for fetching streams
        video: 6,
        audio: 2
    }
    $scope.optionButton = "Show Options";  // Save the state of option button
    $scope.selectedRule = "highestBitrateRule";  // Save the selected ABR strategy
    $scope.selectedMode = 'Multi-Path';  // Save the selected mode
    $scope.globalQuality = {  // Switch the quality by global manual switching ABR strategy
        video: 0,
        audio: 0
    };
    $scope.lifeSignalEnabled = true;  // Whether discard the lowest bitrate as life signals or not

    $scope.streamURLs = {  // Save the selected media sources
        video: [
            "http://localhost:8080/apple/v11/stream.mpd",
            "http://localhost:8080/apple/v11/stream.mpd",
            "http://localhost:8080/apple/v11/stream.mpd",
            "http://localhost:8080/apple/v11/stream.mpd",
            "http://localhost:8080/apple/v11/stream.mpd",
            "http://localhost:8080/apple/v11/stream.mpd"
        ],
        audio: [
            "http://localhost:8080/apple/v11/stream.mpd",
            "http://localhost:8080/apple/v11/stream.mpd"
        ]
    };

    $scope.targetLatency = 10;  // The live delay allowed
    // $scope.minDrift = 0.02;  // The minimal latency deviation allowed
    // $scope.maxDrift = 3;  // The maximal latency deviation allowed
    // $scope.catchupPlaybackRate = 0.5;  // Catchup playback rate
    // $scope.liveCatchupLatencyThreshold = 60;  // Maximal latency allowed to catch up


/////////////////////////////////////////////////////////////////////////////////////
/*                     Global variables (stat & chart related)                     */
/////////////////////////////////////////////////////////////////////////////////////

    $scope.monitorBufferLevel = {  // Monitor data: buffer level
        video: NaN,
        audio: NaN
    };
    $scope.maxBufferLevelBuffer = [];  // Buffer for maximal chart data
    $scope.maxBufferLevel = 0;  // Maximal chart data

    $scope.monitorDownloadingQuality = {  // Monitor data: downloading quality
        video: NaN,
        audio: NaN
    };
    $scope.maxDownloadingQualityBuffer = [];  // Buffer for maximal chart data
    $scope.maxDownloadingQuality = 0;  // Maximal chart data

    $scope.monitorPlaybackQuality = {  // Monitor data: playback quality
        video: NaN,
        audio: NaN
    };
    $scope.monitorPlaybackQualityBuffer = {  // Monitor data: playback quality (For forced switch)
        video: [],
        audio: []
    };
    $scope.maxPlaybackQualityBuffer = [];  // Buffer for maximal chart data
    $scope.maxPlaybackQuality = 0;  // Maximal chart data

    $scope.monitorRtt = {  // Monitor data: RTT
        video: [],
        audio: []
    };
    $scope.monitorRttForLifeSignal = {  // Monitor data: RTT (For life signal fetchers)
        video: [],
        audio: []
    };
    $scope.maxRttBuffer = [];  // Buffer for maximal chart data
    $scope.maxRtt = 0;  // Maximal chart data

    $scope.monitorThroughput = {  // Monitor data: throughput
        video: [],
        audio: []
    };
    $scope.monitorThroughputBuffer = {  // Monitor data: throughput (For average calculation)
        video: [],
        audio: []
    };
    $scope.monitorThroughputExpect = {  // Monitor data: throughput expect
        video: [],
        audio: []
    };
    $scope.maxThroughputBuffer = [];  // Buffer for maximal chart data
    $scope.maxThroughput = 0;  // Maximal chart data

    $scope.maxPointsToChart = 30;  // Set the maximum of the points printed on the charts
    $scope.startupTimeForPlot = NaN;
    $scope.chartColor = [  // Colors of each chart line
    //  '#00CCBE', '#ffd446', '#FF6700', '#44c248', '#ff000a', '#b300ff', '#1100ff'
        '#00CCBE', '#ffd446'
    ];
    $scope.chartColorForShift = [  // Colors of each chart line
    //   red        purple     blue       yellow     green
        '#FF0033', '#CC00FF', '#3366CC', '#FF9900', '#009900',
        '#990033', '#993399', '#0033CC', '#996600', '#006633',
        '#FF6699', '#CC66FF', '#3399FF', '#FFCC00', '#66CC33',
        '#FF6699', '#FF66FF', '#6666CC', '#FFFFCC', '#00CC99',
        '#CC0033', '#CC33CC', '#6699FF', '#FF6600', '#999900',
        '#993366', '#FF33FF', '#3399CC', '#FFCCCC', '#006600',
        '#FF0099', '#CC99FF', '#CCCCFF', '#CC6600', '#99CC00',
        '#FF99CC', '#CC66CC', '#0099CC', '#FFFF33', '#669966'
    ];
    $scope.chartData = {  // Save the buffer level data needs to put on the charts
        bufferLevel: [],
        downloadingQuality: [],
        playbackQuality: [],
        rtt: [],
        throughput: []
    };
    $scope.chartState = {  // Save the charts' states
        bufferLevel: {},
        downloadingQuality: {},
        playbackQuality: {},
        rtt: {},
        throughput: {}
    };
    $scope.chartOptions = {  // Set up the style of the charts
        bufferLevel: {
            legend: {
                labelBoxBorderColor: '#ffffff',
                placement: 'outsideGrid',
                container: '#legend-wrapper_bufferLevel'
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
        },
        downloadingQuality: {
            legend: {
                labelBoxBorderColor: '#ffffff',
                placement: 'outsideGrid',
                container: '#legend-wrapper_downloadingQuality'
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
            yaxes: [{ axisLabel: "kbps" }]
        },
        playbackQuality: {
            legend: {
                labelBoxBorderColor: '#ffffff',
                placement: 'outsideGrid',
                container: '#legend-wrapper_playbackQuality'
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
            yaxes: [{ axisLabel: "kbps" }]
        },
        rtt: {
            legend: {
                labelBoxBorderColor: '#ffffff',
                placement: 'outsideGrid',
                container: '#legend-wrapper_rtt'
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
                max: $scope.maxRtt,
                tickLength: 0,
                tickDecimals: 0,
                color: '#136bfb',
                position: 'right',
                axisLabelPadding: 10
            },
            yaxes: [{axisLabel: "millisecond"}]
        },
        throughput: {
            legend: {
                labelBoxBorderColor: '#ffffff',
                placement: 'outsideGrid',
                container: '#legend-wrapper_throughput'
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
        }
    };

    // $scope.stats = [];  // Save all the stats need to put on the charts


/////////////////////////////////////////////////////////////////////////////////////
/*                            Functions: UI and options                            */
/////////////////////////////////////////////////////////////////////////////////////

    // Setting up media sources
    $scope.setStream = function (item, contentType, num) {
        
        if (contentType != undefined && num != undefined) {
            if (item.name == "COPY") {
                $scope.streamURLs[contentType][num] = $scope.streamURLs[contentType][0];
            } else if (item.name == "CUSTOM") {
                $scope.streamURLs[contentType][num] = "";
            } else {
                $scope.streamURLs[contentType][num] = item.url ? item.url : item.urls[contentType][num % item.urls[contentType].length];
            }
        } else {
            if (item.name == "COPY") {
                for (let i = 0; i < $scope.CONTENT_TYPE.length; i++) {
                    for (let j = 0; j < $scope.streamNum[$scope.CONTENT_TYPE[i]]; j++) {
                        $scope.streamURLs[$scope.CONTENT_TYPE[i]][j] = $scope.streamURLs.video[0];
                    }                    
                }
            } else if (item.name == "CUSTOM") {
                for (let i = 0; i < $scope.CONTENT_TYPE.length; i++) {
                    for (let j = 0; j < $scope.streamNum[$scope.CONTENT_TYPE[i]]; j++) {
                        $scope.streamURLs[$scope.CONTENT_TYPE[i]][j] = "";
                    }                    
                }
            } else {
                if (item.url) {
                    for (let i = 0; i < $scope.CONTENT_TYPE.length; i++) {
                        for (let j = 0; j < $scope.streamNum[$scope.CONTENT_TYPE[i]]; j++) {
                            $scope.streamURLs[$scope.CONTENT_TYPE[i]][j] = item.url;
                        }                    
                    }
                } else {
                    for (let i = 0; i < $scope.CONTENT_TYPE.length; i++) {
                        for (let j = 0; j < $scope.streamNum[$scope.CONTENT_TYPE[i]]; j++) {
                            $scope.streamURLs[$scope.CONTENT_TYPE[i]][j] = item.urls[$scope.CONTENT_TYPE[i]][j % item.urls[$scope.CONTENT_TYPE[i]].length];
                        }                    
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
                $scope.changeABRStrategy('rttBufferRule');
                break;
            default:
                break;
        }

    };

    // Change the number of streams
    $scope.changeStreamNumber = function (contentType) {

        while ($scope.streamURLs[contentType].length < $scope.streamNum[contentType]) {
            $scope.streamURLs[contentType].push($scope.streamURLs.video[0]);
        }
        while ($scope.streamURLs[contentType].length > $scope.streamNum[contentType]) {
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


/////////////////////////////////////////////////////////////////////////////////////
/*                           Functions: charts and stats                           */
/////////////////////////////////////////////////////////////////////////////////////

    // Initializing & clearing the charts
    $scope.initChartingByMediaType = function (id, type) {

        var data = {
            id: id,
            data: $scope.chartState[type][id].data,
            label: $scope.chartState[type][id].label,
            color: $scope.chartState[type][id].color,
            type: type
        };
        switch(type) {
            case "bufferLevel":
                $scope.chartData.bufferLevel.push(data);
                break;
            case "downloadingQuality":
                $scope.chartData.downloadingQuality.push(data);
                break;
            case "playbackQuality":
                $scope.chartData.playbackQuality.push(data);
                break;
            case "rtt":
                $scope.chartData.rtt.push(data);
                break;
            case "throughput":
                $scope.chartData.throughput.push(data);
                break;
        }
        $scope.chartOptions[type].legend.noColumns = Math.min($scope.chartData[type].length, $scope.LEGEND_COLUMN_LENGTH);
        if (document.getElementById(type + '-title')) {
            document.getElementById(type + '-title').style.marginBottom = (Math.ceil($scope.chartData[type].length / $scope.LEGEND_COLUMN_LENGTH) * 20 - 10) + 'px';
        }

    };

    $scope.clearchartData = function () {

        $scope.monitorBufferLevel = {
            video: NaN,
            audio: NaN
        };
        $scope.maxBufferLevelBuffer = [];
        $scope.maxBufferLevel = 0;

        $scope.monitorDownloadingQuality = {
            video: NaN,
            audio: NaN
        };
        $scope.maxDownloadingQualityBuffer = [];
        $scope.maxDownloadingQuality = 0;
    
        $scope.monitorPlaybackQuality = {
            video: NaN,
            audio: NaN
        };
        $scope.monitorPlaybackQualityBuffer = {
            video: [],
            audio: []
        };
        $scope.maxPlaybackQualityBuffer = [];
        $scope.maxPlaybackQuality = 0;
        
        $scope.monitorRtt = {
            video: [],
            audio: []
        };
        $scope.monitorRttForLifeSignal = {
            video: [],
            audio: []
        };
        $scope.maxRttBuffer = [];
        $scope.maxRtt = 0;
    
        $scope.monitorThroughput = {
            video: [],
            audio: []
        };
        $scope.monitorThroughputBuffer = {
            video: [],
            audio: []
        };
        $scope.monitorThroughputExpect = {
            video: [],
            audio: []
        };
        $scope.maxThroughputBuffer = [];
        $scope.maxThroughput = 0;

        for (var key in $scope.chartState) {
            $scope.chartState[key] = {};
            $scope.chartData[key] = [];
        }

    };

    // Plotting data in charts
    $scope.updateCharts = function () {

        let time = $scope.getTimeForPlot();

        for (let i = 0; i < $scope.CONTENT_TYPE.length; i++) {
            if ($scope.streamSourceBuffer[$scope.CONTENT_TYPE[i]]) {
                $scope.monitorBufferLevel[$scope.CONTENT_TYPE[i]] = $scope.getBufferLevel($scope.CONTENT_TYPE[i]);
            }
            if ($scope.streamSourceBuffer[$scope.CONTENT_TYPE[i]] && $scope.monitorPlaybackQualityBuffer[$scope.CONTENT_TYPE[i]].length > 0) {
                for (let j = $scope.monitorPlaybackQualityBuffer[$scope.CONTENT_TYPE[i]].length - 1; j >= 0; j--) {
                    if ($scope.streamElement.currentTime >= $scope.monitorPlaybackQualityBuffer[$scope.CONTENT_TYPE[i]][j].start && $scope.streamElement.currentTime < $scope.monitorPlaybackQualityBuffer[$scope.CONTENT_TYPE[i]][j].end) {
                        $scope.monitorPlaybackQuality[$scope.CONTENT_TYPE[i]] = $scope.monitorPlaybackQualityBuffer[$scope.CONTENT_TYPE[i]][j].bandwidth;
                        break;
                    }
                }
            }
        }

        $scope.maxBufferLevelBuffer.push(($scope.monitorBufferLevel[$scope.CONTENT_TYPE[0]] > $scope.monitorBufferLevel[$scope.CONTENT_TYPE[1]] ? $scope.monitorBufferLevel[$scope.CONTENT_TYPE[0]] : $scope.monitorBufferLevel[$scope.CONTENT_TYPE[1]]) || $scope.monitorBufferLevel[$scope.CONTENT_TYPE[0]] || $scope.monitorBufferLevel[$scope.CONTENT_TYPE[1]] || 0);
        $scope.maxDownloadingQualityBuffer.push((($scope.monitorDownloadingQuality[$scope.CONTENT_TYPE[0]] > $scope.monitorDownloadingQuality[$scope.CONTENT_TYPE[1]] ? $scope.monitorDownloadingQuality[$scope.CONTENT_TYPE[0]] : $scope.monitorDownloadingQuality[$scope.CONTENT_TYPE[1]]) || $scope.monitorDownloadingQuality[$scope.CONTENT_TYPE[0]] || $scope.monitorDownloadingQuality[$scope.CONTENT_TYPE[1]] || 0) / 1000);
        $scope.maxPlaybackQualityBuffer.push((($scope.monitorPlaybackQuality[$scope.CONTENT_TYPE[0]] > $scope.monitorPlaybackQuality[$scope.CONTENT_TYPE[1]] ? $scope.monitorPlaybackQuality[$scope.CONTENT_TYPE[0]] : $scope.monitorPlaybackQuality[$scope.CONTENT_TYPE[1]]) || $scope.monitorPlaybackQuality[$scope.CONTENT_TYPE[0]] || $scope.monitorPlaybackQuality[$scope.CONTENT_TYPE[1]] || 0) / 1000);
        let maxRttTemp = 0;
        if ($scope.monitorRtt[$scope.CONTENT_TYPE[0]].length > 0) {
            maxRttTemp = Math.max(maxRttTemp, $scope.monitorRtt[$scope.CONTENT_TYPE[0]].reduce((a, b)=> isNaN(b) ? a : a > b ? a : b));
        }
        if ($scope.monitorRtt[$scope.CONTENT_TYPE[1]].length > 0) {
            maxRttTemp = Math.max(maxRttTemp, $scope.monitorRtt[$scope.CONTENT_TYPE[1]].reduce((a, b)=> isNaN(b) ? a : a > b ? a : b));
        }
        $scope.maxRttBuffer.push(maxRttTemp);
        let maxThroughputTemp = 0;
        if ($scope.monitorThroughput[$scope.CONTENT_TYPE[0]].length > 0) {
            maxThroughputTemp = Math.max(maxThroughputTemp, $scope.monitorThroughput[$scope.CONTENT_TYPE[0]].reduce((a, b)=> isNaN(b) ? a : a > b ? a : b));
        }
        if ($scope.monitorThroughput[$scope.CONTENT_TYPE[1]].length > 0) {
            maxThroughputTemp = Math.max(maxThroughputTemp, $scope.monitorThroughput[$scope.CONTENT_TYPE[1]].reduce((a, b)=> isNaN(b) ? a : a > b ? a : b));
        }
        $scope.maxThroughputBuffer.push(maxThroughputTemp / 1000);

        if ($scope.maxBufferLevelBuffer.length > $scope.maxPointsToChart) {
            $scope.maxBufferLevelBuffer.shift();
        }
        if ($scope.maxDownloadingQualityBuffer.length > $scope.maxPointsToChart) {
            $scope.maxDownloadingQualityBuffer.shift();
        }
        if ($scope.maxPlaybackQualityBuffer.length > $scope.maxPointsToChart) {
            $scope.maxPlaybackQualityBuffer.shift();
        }
        if ($scope.maxRttBuffer.length > $scope.maxPointsToChart) {
            $scope.maxRttBuffer.shift();
        }
        if ($scope.maxThroughputBuffer.length > $scope.maxPointsToChart) {
            $scope.maxThroughputBuffer.shift();
        }

        $scope.maxBufferLevel = $scope.maxBufferLevelBuffer.reduce((a, b) => a > b ? a : b);
        $scope.maxDownloadingQuality = $scope.maxDownloadingQualityBuffer.reduce((a, b) => a > b ? a : b);
        $scope.maxPlaybackQuality = $scope.maxPlaybackQualityBuffer.reduce((a, b) => a > b ? a : b);
        $scope.maxRtt = $scope.maxRttBuffer.reduce((a, b) => a > b ? a : b);
        $scope.maxThroughput = $scope.maxThroughputBuffer.reduce((a, b) => a > b ? a : b);

        $scope.chartOptions.bufferLevel.yaxis.max = $scope.maxBufferLevel;
        $scope.chartOptions.downloadingQuality.yaxis.max = $scope.maxDownloadingQuality;
        $scope.chartOptions.playbackQuality.yaxis.max = $scope.maxPlaybackQuality;
        $scope.chartOptions.rtt.yaxis.max = $scope.maxRtt;
        $scope.chartOptions.throughput.yaxis.max = $scope.maxThroughput;

        for (let i = 0; i < $scope.CONTENT_TYPE.length; i++) {
            if ($scope.streamSourceBuffer[$scope.CONTENT_TYPE[i]]) {
                $scope.plotPoint($scope.CONTENT_TYPE[i], 'bufferLevel', $scope.monitorBufferLevel[$scope.CONTENT_TYPE[i]], time);
                $scope.plotPoint($scope.CONTENT_TYPE[i], 'downloadingQuality', $scope.monitorDownloadingQuality[$scope.CONTENT_TYPE[i]] / 1000, time);
                $scope.plotPoint($scope.CONTENT_TYPE[i], 'playbackQuality', $scope.monitorPlaybackQuality[$scope.CONTENT_TYPE[i]] / 1000, time);
                for (let j = 0; j < $scope.monitorRtt[$scope.CONTENT_TYPE[i]].length; j++) {
                    if ($scope.monitorRtt[$scope.CONTENT_TYPE[i]][j] != undefined) {
                        $scope.plotPoint($scope.CONTENT_TYPE[i] + '_' + j, 'rtt', $scope.monitorRtt[$scope.CONTENT_TYPE[i]][j], time);
                    }
                    if ($scope.monitorThroughput[$scope.CONTENT_TYPE[i]][j] != undefined) {
                        $scope.plotPoint($scope.CONTENT_TYPE[i] + '_' + j, 'throughput', $scope.monitorThroughput[$scope.CONTENT_TYPE[i]][j] / 1000, time);
                    }
                }
            }
        }

    };

    $scope.getTimeForPlot = function () {

        let now = new Date().getTime() / 1000;
        if (isNaN($scope.startupTimeForPlot)) {
            $scope.startupTimeForPlot = now;
        }
        return Math.max(now - $scope.startupTimeForPlot, 0);

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
/*                            Functions: media players                             */
/////////////////////////////////////////////////////////////////////////////////////

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
        for (let i = 0; i < $scope.intervalLifeSignalFunctions.video.length; i++) {
            if ($scope.intervalLifeSignalFunctions.video[i]) {
                clearInterval($scope.intervalLifeSignalFunctions.video[i]);
            }
        }
        for (let i = 0; i < $scope.intervalLifeSignalFunctions.audio.length; i++) {
            if ($scope.intervalLifeSignalFunctions.audio[i]) {
                clearInterval($scope.intervalLifeSignalFunctions.audio[i]);
            }
        }
        $scope.intervalFunctions = [];
        $scope.intervalLifeSignalFunctions.video = [];
        $scope.intervalLifeSignalFunctions.audio = [];

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
        $scope.streamStartTime = NaN;
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

        for (let i = 0; i < $scope.CONTENT_TYPE.length; i++) {
            if ($scope.streamSourceBuffer[$scope.CONTENT_TYPE[i]]) {
                $scope.streamSourceBuffer[$scope.CONTENT_TYPE[i]].removeEventListener($scope.EVENT_UPDATE_END, $scope.appendBuffer);
                $scope.streamSourceBuffer[$scope.CONTENT_TYPE[i]].removeEventListener($scope.EVENT_UPDATE_END, $scope.onBufferLevelUpdated);
                $scope.mediaSource.removeSourceBuffer($scope.streamSourceBuffer[$scope.CONTENT_TYPE[i]]);
            }
        }
        $scope.streamSourceBuffer = {
            video: null,
            audio: null
        };

        if ($scope.controllBar) {
            $scope.streamElement.removeEventListener($scope.EVENT_TIME_UPDATE, $scope.controllBar.onPlaybackTimeUpdate);
            $scope.controllBar.destroy();
            $scope.controllBar = null;
        }

        if ($scope.streamElement) {
            $scope.streamElement.src = "";
            $scope.streamElement = null;
        }

        if ($scope.mediaSource) {
            $scope.mediaSource.removeEventListener('sourceopen', $scope.sourceOpen);
            // $scope.mediaSource.endOfStream();
            delete $scope.mediaSource;
        }

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

    // Triggered when mediaSoure is ready to open sources
    $scope.sourceOpen = function() {

        setTimeout(() => {

            // Fetch and load MPDs
            for (let i = 0; i < $scope.CONTENT_TYPE.length; i++) {
                for (let j = 0; j < $scope.streamNum[$scope.CONTENT_TYPE[i]]; j++) {
                    $scope.fetchMpd($scope.CONTENT_TYPE[i], $scope.streamURLs[$scope.CONTENT_TYPE[i]][j], (response, requestInfo) => {
                        // $scope.monitorThroughputBuffer[$scope.CONTENT_TYPE[i]][j] = [((requestInfo.tsize / ((requestInfo.tfinish - requestInfo.trequest) / 1000)).toFixed(0))];
                        // $scope.monitorThroughput[$scope.CONTENT_TYPE[i]][j] = $scope.calculateAverageThroughput($scope.CONTENT_TYPE[i], j);
                        $scope.monitorThroughputBuffer[$scope.CONTENT_TYPE[i]][j] = [];
                        $scope.monitorThroughput[$scope.CONTENT_TYPE[i]][j] = 0;
                        $scope.monitorThroughputExpect[$scope.CONTENT_TYPE[i]][j] = Infinity;
                        $scope.monitorRtt[$scope.CONTENT_TYPE[i]][j] = requestInfo.tresponse - requestInfo.trequest;
                        $scope.requestList.unshift({
                            urlType: $scope.TYPE_OF_MPD,
                            contentType: $scope.CONTENT_TYPE[i],
                            pathIndex: j,
                            periodIndex: "-",
                            adaptationSetIndex: "-",
                            representationIndex: "-",
                            segmentIndex: "-",
                            tresponse_trequest: requestInfo.tresponse - requestInfo.trequest,
                            tfinish_tresponse: requestInfo.tfinish - requestInfo.tresponse,
                            tfinish_trequest: requestInfo.tfinish - requestInfo.trequest,
                            tsize: requestInfo.tsize,
                            rtt: $scope.monitorRtt[$scope.CONTENT_TYPE[i]][j],
                            throughput: $scope.monitorThroughput[$scope.CONTENT_TYPE[i]][j],
                            throughputExpect: $scope.monitorThroughputExpect[$scope.CONTENT_TYPE[i]][j]
                        });
                        $scope.loadMpd(response, $scope.CONTENT_TYPE[i], j);
                    });
                }
            }

            // Add event listeners:  update playback time
            $scope.streamElement.addEventListener($scope.EVENT_TIME_UPDATE, $scope.onPlaybackTimeUpdate);
            $scope.streamElement.addEventListener($scope.PLAYING, $scope.onSetPauseBtn);
            $scope.streamElement.addEventListener($scope.PAUSE, $scope.onSetPlayBtn);
            $scope.streamElement.addEventListener($scope.WAITING, $scope.onSetPlayBtn);            

            // Add interval function: append buffers in intervals
            $scope.intervalFunctions.push(setInterval($scope.appendBuffer, $scope.INTERVAL_OF_APPEND_BUFFER));

            // Add interval function: update charts
            $scope.intervalFunctions.push(setInterval($scope.updateCharts, $scope.INTERVAL_OF_UPDATE_CHARTS));

        }, $scope.TIMEOUT_OF_SOURCE_OPEN);

    };

    // Fetch MPDs by a request
    $scope.fetchMpd = function(contentType, url, callback) {

        if (url == "") {
            window.alert("Empty URL when fetching MPD!");
            return;
        }
        $scope.fetchBuffer(contentType, $scope.resolveUrl($scope.TYPE_OF_MPD, url), $scope.RESPONSE_TYPE_OF_MPD, callback);

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
            if (!manifest.type || ($scope.streamIsDynamic && (manifest.type == "dynamic") != $scope.streamIsDynamic)) {
                throw "Different type of manifest!";
            }
            
            // Check if the duration is equal
            if ((manifest.type == "static" && (!manifest.mediaPresentationDuration || ($scope.streamDuration && manifest.mediaPresentationDuration != $scope.streamDuration)))
                || (manifest.type == "dynamic" && (!manifest.availabilityStartTime || ($scope.streamStartTime && manifest.availabilityStartTime.getTime() != $scope.streamStartTime.getTime())))
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
                                    if (manifest.type == "dynamic") {
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
            // Initialize charts
            let color = $scope.chartColorForShift.shift();
            $scope.chartState["throughput"][contentType + "_" + i] = {
                data: [],
                color: color,
                label: contentType + "_" + i
            };
            $scope.initChartingByMediaType(contentType + "_" + i, "throughput");
            $scope.chartState["rtt"][contentType + "_" + i] = {
                data: [],
                color: color,
                label: contentType + "_" + i
            };
            $scope.initChartingByMediaType(contentType + "_" + i, "rtt");
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
                                    if (manifest.type == "static") {
                                        curStreamInfo.segmentIndex = $scope.streamBitrateList[contentType][i][j][jj][firstsmall.key].startNumber || 0;  /////////////////
                                    } else if (manifest.type == "dynamic") {
                                        let availabilityStartTime = $scope.streamBitrateList[contentType][i][j][jj][firstsmall.key].availabilityStartTime.getTime();
                                        let timeShiftBufferDepth = $scope.streamBitrateList[contentType][i][j][jj][firstsmall.key].timeShiftBufferDepth;
                                        let targetLatency = $scope.targetLatency > timeShiftBufferDepth ? timeShiftBufferDepth : $scope.targetLatency;
                                        let targetTime = Math.max(0, (new Date().getTime()) - availabilityStartTime - (targetLatency * 1000));
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
            if (!$scope.streamSourceBufferMimeCodecs[contentType]) {
                $scope.streamSourceBufferMimeCodecs[contentType] = curStreamInfo.mimeCodecs;
                // Only need either video or audio SourceBuffer
                if ($scope.streamNum[contentType == $scope.CONTENT_TYPE[0] ? $scope.CONTENT_TYPE[1] : $scope.CONTENT_TYPE[0]] == 0) {
                    $scope.streamSourceBuffer[contentType] = $scope.mediaSource.addSourceBuffer(curStreamInfo.mimeCodecs);
                    // Add event listeners:  1. append buffers from listeners   2. update buffer levels
                    $scope.streamSourceBuffer[contentType].addEventListener($scope.EVENT_UPDATE_END, $scope.appendBuffer);
                    $scope.streamSourceBuffer[contentType].addEventListener($scope.EVENT_UPDATE_END, $scope.onBufferLevelUpdated);
                } 
                // Need both video and audio SourceBuffers
                else if ($scope.streamSourceBufferMimeCodecs[contentType == $scope.CONTENT_TYPE[0] ? $scope.CONTENT_TYPE[1] : $scope.CONTENT_TYPE[0]]) {
                    for (let i = 0; i < $scope.CONTENT_TYPE.length; i++) {
                        $scope.streamSourceBuffer[$scope.CONTENT_TYPE[i]] = $scope.mediaSource.addSourceBuffer($scope.streamSourceBufferMimeCodecs[$scope.CONTENT_TYPE[i]]);
                        // Add event listeners:  1. append buffers from listeners   2. update buffer levels
                        $scope.streamSourceBuffer[$scope.CONTENT_TYPE[i]].addEventListener($scope.EVENT_UPDATE_END, $scope.appendBuffer);
                        $scope.streamSourceBuffer[$scope.CONTENT_TYPE[i]].addEventListener($scope.EVENT_UPDATE_END, $scope.onBufferLevelUpdated);
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
                $scope.streamTimeShiftDepth = manifest.timeShiftBufferDepth;
                $scope.mediaSource.duration = Infinity;
            }
            if (isNaN($scope.streamIsDynamic)) {
                $scope.streamIsDynamic = manifest.type == "static" ? false : manifest.type == "dynamic" ? true : false;
            }
            $scope.autoSwitchTrack[contentType] = true;  // Use path switching as default
            $scope.autoSwitchBitrate[contentType] = true;  // Use ABR rules as default
            $scope.isFetchingSegment[contentType] = false;
            $scope.isSeeking = false;

            // Set the startup time of the player
            $scope.startupTime = new Date(parseInt(new Date().getTime()));
            $scope.startupTimeFormatted = $scope.startupTime.toLocaleString();

            // Initialize charts
            $scope.chartState["bufferLevel"][contentType] = {
                data: [],
                color: $scope.chartColor[contentType == "video" ? 0 : 1],
                label: contentType
            };
            $scope.initChartingByMediaType(contentType, "bufferLevel");
            $scope.chartState["downloadingQuality"][contentType] = {
                data: [],
                color: $scope.chartColor[contentType == "video" ? 0 : 1],
                label: contentType
            };
            $scope.initChartingByMediaType(contentType, "downloadingQuality");
            $scope.chartState["playbackQuality"][contentType] = {
                data: [],
                color: $scope.chartColor[contentType == "video" ? 0 : 1],
                label: contentType
            };
            $scope.initChartingByMediaType(contentType, "playbackQuality");

            return "SUCCESS";
        } catch (e) {
            return "registerFirstStreamInfo: " + e;
        }

    };

    // Run when the segment need to be fetched from servers
    $scope.fetchSegment = function(contentType, urlType) {

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
            lastSegmentIndex: $scope.streamInfo[contentType].mimeCodecs
        };
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
        
        $scope.fetchBuffer(contentType, urlResolved, $scope.RESPONSE_TYPE_OF_SEGMENT, 
            (buffer, requestInfo) => {
                $scope.monitorThroughputBuffer[contentType][curStreamInfo.pathIndex].push((requestInfo.tsize / ((requestInfo.tfinish - requestInfo.trequest) / 1000)).toFixed(0));
                // $scope.monitorThroughput[contentType][curStreamInfo.pathIndex] = $scope.calculateAverageThroughput(contentType, curStreamInfo.pathIndex).toFixed(0);
                $scope.monitorThroughput[contentType][curStreamInfo.pathIndex] = (requestInfo.tsize / ((requestInfo.tfinish - requestInfo.trequest) / 1000)).toFixed(0);
                $scope.monitorThroughputExpect[contentType][curStreamInfo.pathIndex] = !isNaN(requestInfo.bufferLevel) ? (requestInfo.tsize / requestInfo.bufferLevel).toFixed(0) : Infinity;
                $scope.monitorRtt[contentType][curStreamInfo.pathIndex] = requestInfo.tresponse - requestInfo.trequest;
                clearInterval($scope.intervalLifeSignalFunctions[contentType][curStreamInfo.pathIndex]);
                $scope.intervalLifeSignalFunctions[contentType][curStreamInfo.pathIndex] = setInterval($scope.lifeSignalFetcher.bind(this, contentType, curStreamInfo.pathIndex), $scope.INTERVAL_OF_LIFE_SIGNAL_FETCHER);
                $scope.requestList.unshift({
                    urlType: urlType,
                    contentType: contentType,
                    pathIndex: curStreamInfo.pathIndex,
                    periodIndex: curStreamInfo.periodIndex,
                    adaptationSetIndex: curStreamInfo.adaptationSetIndex,
                    representationIndex: curStreamInfo.representationIndex,
                    segmentIndex: curStreamInfo.segmentIndex,
                    tresponse_trequest: requestInfo.tresponse - requestInfo.trequest,
                    tfinish_tresponse: requestInfo.tfinish - requestInfo.tresponse,
                    tfinish_trequest: requestInfo.tfinish - requestInfo.trequest,
                    tsize: requestInfo.tsize,
                    rtt: $scope.monitorRtt[contentType][curStreamInfo.pathIndex],
                    throughput: $scope.monitorThroughput[contentType][curStreamInfo.pathIndex],
                    throughputExpect: $scope.monitorThroughputExpect[contentType][curStreamInfo.pathIndex]
                });
                $scope.loadSegment(buffer, contentType, curStreamInfo, urlType);
                $scope.isFetchingSegment[contentType] = false;
            },
            (status) => {
                if (status == 404) {
                    console.log("No file(" + status + "): " + urlResolved);
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
            curStreamInfo: curStreamInfo
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
            if ($scope.streamInfo[contentType].segmentIndex > $scope.streamBitrateList[contentType][$scope.streamInfo[contentType].pathIndex][$scope.streamInfo[contentType].periodIndex][$scope.streamInfo[contentType].adaptationSetIndex][$scope.streamInfo[contentType].representationIndex].segmentNum + $scope.streamBitrateList[contentType][$scope.streamInfo[contentType].pathIndex][$scope.streamInfo[contentType].periodIndex][$scope.streamInfo[contentType].adaptationSetIndex][$scope.streamInfo[contentType].representationIndex].startNumber - 1) {
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
                    $scope.streamInfo[contentType].segmentIndex = $scope.streamBitrateList[contentType][$scope.streamInfo[contentType].pathIndex][$scope.streamInfo[contentType].periodIndex][$scope.streamInfo[contentType].adaptationSetIndex][$scope.streamInfo[contentType].representationIndex].startNumber;
                }
            }
        }
        $scope.scheduleFetcher(contentType);

    };

    // Create and load a XMLHttpRequest
    $scope.fetchBuffer = function(contentType, url, responseType, callback, noFile) {

        if (!url) {
            window.alert("The URL is invalid: " + url);
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
                callback(xhr.response, requestInfo);
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
                requestInfo.tresponse = performance.now();
                firstByteReceived = true;
            }
        };
        xhr.ontimeout = function () {
            if (noFile) {
                noFile(xhr.status);
            }
        };
        requestInfo.trequest = performance.now();
        requestInfo.bufferLevel = $scope.getBufferLevel(contentType);
        xhr.send();

    };


/////////////////////////////////////////////////////////////////////////////////////
/*                           Functions: assisted tools                             */
/////////////////////////////////////////////////////////////////////////////////////

    // Get the buffer level of videos/audios
    $scope.getBufferLevel = function(contentType) {

        if (!$scope.streamSourceBuffer[contentType]) {
            return NaN;
        }
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

    // Calculate average throughput
    $scope.calculateAverageThroughput = function(contentType, pathIndex) {

        if ($scope.monitorThroughputBuffer[contentType][pathIndex].length < $scope.AVERAGE_THROUGHPUT_WINDOW) {
            return $scope.monitorThroughputBuffer[contentType][pathIndex].reduce((a, b) => a + b, 0) / $scope.monitorThroughputBuffer[contentType][pathIndex].length;
        } else {
            return $scope.monitorThroughputBuffer[contentType][pathIndex].slice(- $scope.AVERAGE_THROUGHPUT_WINDOW).reduce((a, b) => a + b, 0) / $scope.AVERAGE_THROUGHPUT_WINDOW;
        }

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

    // Fetch life signals intervally
    $scope.lifeSignalFetcher = function(contentType, pathIndex) {
        
        if ($scope.monitorRttForLifeSignal[contentType][pathIndex] == $scope.monitorRtt[contentType][pathIndex]) {
            $scope.fetchBuffer(contentType, $scope.streamURLs[contentType][pathIndex], $scope.RESPONSE_TYPE_OF_LIFE_SIGNAL,
                (buffer, requestInfo) => {
                    // $scope.monitorThroughputBuffer[contentType][pathIndex].push((requestInfo.tsize / ((requestInfo.tfinish - requestInfo.trequest) / 1000)).toFixed(0));
                    // $scope.monitorThroughput[contentType][pathIndex] = $scope.calculateAverageThroughput(contentType, pathIndex);
                    $scope.monitorRtt[contentType][pathIndex] = requestInfo.tresponse - requestInfo.trequest;
                    $scope.monitorRttForLifeSignal[contentType][pathIndex] = $scope.monitorRtt[contentType][pathIndex];
                    $scope.requestList.unshift({
                        urlType: $scope.TYPE_OF_LIFE_SIGNAL,
                        contentType: contentType,
                        pathIndex: pathIndex,
                        periodIndex: "-",
                        adaptationSetIndex: "-",
                        representationIndex: "-",
                        segmentIndex: "-",
                        tresponse_trequest: requestInfo.tresponse - requestInfo.trequest,
                        tfinish_tresponse: requestInfo.tfinish - requestInfo.tresponse,
                        tfinish_trequest: requestInfo.tfinish - requestInfo.trequest,
                        tsize: requestInfo.tsize,
                        rtt: $scope.monitorRtt[contentType][pathIndex],
                        // throughput: $scope.monitorThroughput[contentType][pathIndex],
                        throughput: "-",
                        throughputExpect: "-"
                    });
                },
                (status) => {
                    console.log("No life signal(" + status + "): " + $scope.streamURLs[contentType][pathIndex]);
                }
            );
        } else {
            $scope.monitorRttForLifeSignal[contentType][pathIndex] = $scope.monitorRtt[contentType][pathIndex];
        }

    };

    // Fetch the segments periodly if isFetchingSegment is false
    $scope.scheduleFetcher = function(contentType) {
    
        let bufferLevel = $scope.getBufferLevel(contentType);
        let bufferToAppend = 0;
        for (let i = 0; i < $scope.streamBufferToAppend[contentType].length; i++) {
            let buffer = $scope.streamBufferToAppend[contentType][i];
            bufferToAppend += ($scope.streamBitrateList[contentType][buffer.curStreamInfo.pathIndex][buffer.curStreamInfo.periodIndex][buffer.curStreamInfo.adaptationSetIndex][buffer.curStreamInfo.representationIndex].duration
                || $scope.streamBitrateList[contentType][buffer.curStreamInfo.pathIndex][buffer.curStreamInfo.periodIndex][buffer.curStreamInfo.adaptationSetIndex][buffer.curStreamInfo.representationIndex].d)
                / $scope.streamBitrateList[contentType][buffer.curStreamInfo.pathIndex][buffer.curStreamInfo.periodIndex][buffer.curStreamInfo.adaptationSetIndex][buffer.curStreamInfo.representationIndex].timescale;
        }
        if ($scope.streamSourceBuffer[contentType] && !$scope.isSeeking && !$scope.isFetchingSegment[contentType] && !isNaN(bufferLevel) && (bufferLevel + bufferToAppend) < $scope.targetBuffer
                && !isNaN($scope.streamBitrateList[contentType][$scope.streamInfo[contentType].pathIndex][$scope.streamInfo[contentType].periodIndex][$scope.streamInfo[contentType].adaptationSetIndex][$scope.streamInfo[contentType].representationIndex].segmentNum) 
                && $scope.streamInfo[contentType].segmentIndex <= $scope.streamBitrateList[contentType][$scope.streamInfo[contentType].pathIndex][$scope.streamInfo[contentType].periodIndex][$scope.streamInfo[contentType].adaptationSetIndex][$scope.streamInfo[contentType].representationIndex].segmentNum
                && (!$scope.streamIsDynamic || 1)) {  ////////////
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

    // Update the buffer level in the control bar periodly
    $scope.onBufferLevelUpdated = function () {

        if ($scope.controllBar && $scope.controllBar.onBufferLevelUpdated) {
            $scope.controllBar.onBufferLevelUpdated();
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

        if ($scope.controllBar && $scope.controllBar.setPauseBtn) {
            $scope.controllBar.setPauseBtn();
        }

    };
    
    // Triggered when the player stops or waits
    $scope.onSetPlayBtn = function () {

        if ($scope.controllBar && $scope.controllBar.setPlayBtn) {
            $scope.controllBar.setPlayBtn();
        }

    };

    // Set the fastest mediaplayer's timeline as the normalized time
    $scope.setNormalizedTime = function() {
    };

    // Compute total throughput according to recent HTTP requests (Total data in ONE second)
    $scope.computetotalThroughput = function() {
    };

    // Compute QoE
    $scope.computeQoE = function() {
    };

    // Other platform intervals
    setInterval(() => {
        $scope.UTCTime = new Date(parseInt(new Date().getTime())).toLocaleString();
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