var MultiPathRule;

// Rule that selects the possible manual switching bitrate
function MultiPathRuleClass() {

    var appElement = document.querySelector('[ng-controller=DashController]');
    var $scope = window.angular ? window.angular.element(appElement).scope() : undefined;
    let factory = dashjs.FactoryMaker;
    let SwitchRequest = factory.getClassFactoryByName('SwitchRequest');
    let context = this.context;
    let instance;

    function setup() {
    }

    // Always select the manual switching bitrate
    function getMaxIndex(rulesContext) {
        const switchRequest = SwitchRequest(context).create();

        if (!rulesContext || !rulesContext.hasOwnProperty('getMediaInfo') || !rulesContext.hasOwnProperty('getAbrController')) {
            return switchRequest;
        }

        const mediaType = rulesContext.getMediaInfo().type;
        const abrController = rulesContext.getAbrController();
        let info = abrController.getSettings().info;

        if (mediaType != "video") {  // Default settings for audio
            return switchRequest;           
        }

        // Appropriate bitrate for the highest throughput, otherwise the lowest bitrate
        switchRequest.quality = $scope.playerDownloadingQuality[info.count];
        switchRequest.reason = 'Appropriate bitrate for the highest throughput, otherwise the lowest bitrate';
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

MultiPathRuleClass.__dashjs_factory_name = 'MultiPathRule';
MultiPathRule = dashjs.FactoryMaker.getClassFactory(MultiPathRuleClass);

