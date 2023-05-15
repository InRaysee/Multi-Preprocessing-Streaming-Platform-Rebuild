var FOVRule;

// Rule that selects the possible bitrate according to FOV
function FOVRuleClass() {

    var appElement = document.querySelector('[ng-controller=DashController]');
    var $scope = angular.element(appElement).scope();
    let factory = dashjs.FactoryMaker;
    let SwitchRequest = factory.getClassFactoryByName('SwitchRequest');
    let context = this.context;
    let instance;

    function setup() {
    }

    // Always select a bitrate according to FOV
    function getMaxIndex(rulesContext) {
        const switchRequest = SwitchRequest(context).create();

        if (!rulesContext || !rulesContext.hasOwnProperty('getMediaInfo') || !rulesContext.hasOwnProperty('getAbrController')) {
            return switchRequest;
        }

        const mediaType = rulesContext.getMediaInfo().type;
        const mediaInfo = rulesContext.getMediaInfo();
        const abrController = rulesContext.getAbrController();

        if (mediaType != "video") {  // Default settings for audio
            return switchRequest;           
        }

        // Compute the bitrate according to FOV
        var info = abrController.getSettings().info;
        var priorite = computeQualities(info);  // From 0 to 100

        // Ask to switch to the bitrate according to FOV
        switchRequest.quality = 0;
        switchRequest.reason = 'Always switching to the bitrate according to FOV';
        switchRequest.priority = SwitchRequest.PRIORITY.STRONG;

        const bitrateList = abrController.getBitrateList(mediaInfo);  // List of all the selectable bitrates (A - Z)
        for (let i = bitrateList.length - 1; i >= 0; i--) {
            if (priorite >= (i * 100 / bitrateList.length)) {
                switchRequest.quality = i;
                break;
            }
        }

        return switchRequest;
    }

    function computeQualities(info) {

        if (!info) {
            console.log("Lack of info when computing FOV-based qualities!!!");
            return 0;
        }

        if ($scope.lat == null || $scope.lon == null || $scope.lat > 90 || $scope.lat < -90 || $scope.lon > 360 || $scope.lon < 0) {
            console.log("Wrong $scope.lat & $scope.lon when computing FOV-based qualities!!!");
            return 0;
        }
    
        let lonscore = 0, latscore = 0;

        if ( info.count == 0 ) {
            if ($scope.lon <= 30) {
                lonscore = 100 * ((30 - $scope.lon) / 120);
            } else if ($scope.lon <= 150) {
                lonscore = 0;
            } else if ($scope.lon <= 270) {
                lonscore = 100 * (($scope.lon - 150) / 120);
            } else if ($scope.lon <= 360) {
                lonscore = 100 * ((120 - ($scope.lon - 270)) / 120);
            }
            latscore = 100 * ((90 - Math.abs($scope.lat)) / 90);
            return (lonscore + latscore) / 2;
        }

        if ( info.count == 1 ) {
            if ($scope.lon <= 90) {
                lonscore = 100 * (($scope.lon + 30) / 120);
            } else if ($scope.lon <= 210) {
                lonscore = 100 * ((120 - ($scope.lon - 90)) / 120);
            } else if ($scope.lon <= 330) {
                lonscore = 0;
            } else if ($scope.lon <= 360) {
                lonscore = 100 * (($scope.lon - 330) / 120);
            }
            latscore = 100 * ((90 - Math.abs($scope.lat)) / 90);
            return (lonscore + latscore) / 2;
        }

        if ( info.count == 2 ) {
            if ($scope.lat >= -30) {
                latscore = 100 * (($scope.lat + 30) / 120);
            } else {
                latscore = 0;
            }
            return latscore;
        }

        if ( info.count == 3 ) {
            if ($scope.lat <= 30) {
                latscore = 100 * ((30 - $scope.lat) / 120);
            } else {
                latscore = 0;
            }
            return latscore;
        }

        if ( info.count == 4 ) {
            if ($scope.lon <= 120) {
                lonscore = 100 * ((120 - $scope.lon) / 120);
            } else if ($scope.lon <= 240) {
                lonscore = 0;
            } else if ($scope.lon <= 360) {
                lonscore = 100 * (($scope.lon - 240) / 120);
            }
            latscore = 100 * ((90 - Math.abs($scope.lat)) / 90);
            return (lonscore + latscore) / 2;
        }

        if ( info.count == 5 ) {
            if ($scope.lon <= 60) {
                lonscore = 0;
            } else if ($scope.lon <= 180) {
                lonscore = 100 * (($scope.lon - 60) / 120);
            } else if ($scope.lon <= 300) {
                lonscore = 100 * ((300 - $scope.lon) / 120);
            } else if ($scope.lon <= 360) {
                lonscore = 0;
            }
            latscore = 100 * ((90 - Math.abs($scope.lat)) / 90);
            return (lonscore + latscore) / 2;
        }

        return 0;
    }

    instance = {
        getMaxIndex: getMaxIndex,
        computeQualities: computeQualities
    };

    setup();

    return instance;
}

FOVRuleClass.__dashjs_factory_name = 'FOVRule';
FOVRule = dashjs.FactoryMaker.getClassFactory(FOVRuleClass);

