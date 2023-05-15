var GlobalSwitchRule;

// Rule that selects the possible global switching bitrate
function GlobalSwitchRuleClass() {

    var appElement = document.querySelector('[ng-controller=DashController]');
    var $scope = window.angular ? window.angular.element(appElement).scope() : undefined;
    let factory = dashjs.FactoryMaker;
    let SwitchRequest = factory.getClassFactoryByName('SwitchRequest');
    let context = this.context;
    let instance;

    function setup() {
    }

    // Always select the global switching bitrate
    function getMaxIndex(rulesContext) {
        const switchRequest = SwitchRequest(context).create();

        if (!rulesContext || !rulesContext.hasOwnProperty('getMediaInfo') || !rulesContext.hasOwnProperty('getAbrController')) {
            return switchRequest;
        }

        const mediaType = rulesContext.getMediaInfo().type;
        const mediaInfo = rulesContext.getMediaInfo();
        const abrController = rulesContext.getAbrController();

        var info = abrController.getSettings().info;
        const bitrateList = abrController.getBitrateList(mediaInfo);  // List of all the selectable bitrates (A - Z)

        if (mediaType != "video") {  // Default settings for audio
            return switchRequest;           
        }

        // Ask to switch to the global switching bitrate
        switchRequest.quality = $scope.playerDownloadingQuality[info.count];
        switchRequest.reason = 'Always switching to the global switching bitrate';
        switchRequest.priority = SwitchRequest.PRIORITY.STRONG;

        if (info && info.count != undefined) {
            if ($scope.changeQualityFlag[info.count] == 1) {
                switchRequest.quality = $scope.multiPathQuality[info.count];
                $scope.changeQualityFlag[info.count] = 0;
                for (let i = 0; i < $scope.playerNum; i++) {
                    if (i != info.count && $scope.changeQualityFlag[i] == 0) {
                        $scope.multiPathQuality[i] = 0;
                    }
                }
            } else {
                switchRequest.quality = $scope.multiPathQuality[info.count];
            }
        }

        return switchRequest;
    }

    instance = {
        getMaxIndex: getMaxIndex,
    };

    setup();

    return instance;
}

GlobalSwitchRuleClass.__dashjs_factory_name = 'GlobalSwitchRule';
GlobalSwitchRule = dashjs.FactoryMaker.getClassFactory(GlobalSwitchRuleClass);

