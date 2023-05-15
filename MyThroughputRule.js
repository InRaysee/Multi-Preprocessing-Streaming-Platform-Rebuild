var MyThroughputRule;

function MyThroughputRule(config) {

    var appElement = document.querySelector('[ng-controller=DashController]');
    var $scope = window.angular ? window.angular.element(appElement).scope() : undefined;
    config = config || {};
    const context = this.context;
    const dashMetrics = config.dashMetrics;
    let factory = dashjs.FactoryMaker;
    let SwitchRequest = factory.getClassFactoryByName('SwitchRequest');
    const MISSING_CONFIG_ERROR = 'Missing config parameter(s)';
    const ABANDON_LOAD = 'abandonload';
    const BUFFER_LOADED = 'bufferLoaded';

    let instance;

    function setup() {
    }

    function checkConfig() {
        if (!dashMetrics || !dashMetrics.hasOwnProperty('getCurrentBufferState')) {
            throw new Error(MISSING_CONFIG_ERROR);
        }
    }

    function getMaxIndex(rulesContext) {
        const switchRequest = SwitchRequest(context).create();

        if (!rulesContext || !rulesContext.hasOwnProperty('getMediaInfo') || !rulesContext.hasOwnProperty('getMediaType') || !rulesContext.hasOwnProperty('useBufferOccupancyABR') ||
            !rulesContext.hasOwnProperty('getAbrController') || !rulesContext.hasOwnProperty('getScheduleController')) {
            return switchRequest;
        }

        checkConfig();

        const mediaInfo = rulesContext.getMediaInfo();
        const mediaType = rulesContext.getMediaType();
        const currentBufferState = dashMetrics.getCurrentBufferState(mediaType);
        const scheduleController = rulesContext.getScheduleController();
        const abrController = rulesContext.getAbrController();
        const streamInfo = rulesContext.getStreamInfo();
        const streamId = streamInfo ? streamInfo.id : null;
        const isDynamic = streamInfo && streamInfo.manifestInfo ? streamInfo.manifestInfo.isDynamic : null;
        const throughputHistory = abrController.getThroughputHistory();
        const throughput = throughputHistory.getSafeAverageThroughput(mediaType, isDynamic);
        const latency = throughputHistory.getAverageLatency(mediaType);
        const useBufferOccupancyABR = rulesContext.useBufferOccupancyABR();
        const bitrateList = abrController.getBitrateList(mediaInfo);  // List of all the selectable bitrates

        if (isNaN(throughput) || !currentBufferState || useBufferOccupancyABR) {
            return switchRequest;
        }

        if (abrController.getAbandonmentStateFor(streamId, mediaType) !== ABANDON_LOAD) {
            if (currentBufferState.state === BUFFER_LOADED || isDynamic) {
                switchRequest.quality = abrController.getQualityForBitrate(mediaInfo, throughput, streamId, latency);
                scheduleController.setTimeToLoadDelay(0);
                switchRequest.reason = {throughput: throughput, latency: latency};
            }
        }

        if ($scope.lifeSignalEnabled && switchRequest.quality == 0 && bitrateList.length > 1) {
            switchRequest.quality = 1;
            switchRequest.reason = "Changed forcedly due to life signal enabled";
        }

        return switchRequest;
    }

    function reset() {
        // no persistent information to reset
    }

    instance = {
        getMaxIndex,
        reset
    };

    setup();

    return instance;
}

MyThroughputRule.__dashjs_factory_name = 'MyThroughputRule';
MyThroughputRule = dashjs.FactoryMaker.getClassFactory(MyThroughputRule);
