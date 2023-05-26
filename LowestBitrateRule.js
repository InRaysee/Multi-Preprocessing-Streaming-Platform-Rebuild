// Rule that selects the possible lowest bitrate
var LowestBitrateRuleClass = function () {

    let instance;
    let appElement = document.querySelector('[ng-controller=DashController]');
    let $scope = window.angular ? window.angular.element(appElement).scope() : undefined;

    function setup() {
    }

    // Always select the lowest bitrate
    function setStreamInfo(streamInfo, contentType) {
        
        if (!$scope.streamBitrateLists || !$scope.streamBitrateLists[contentType]) {
            return streamInfo;
        }

        let firstsmall, secondsmall;
        for (let i = 0; i < $scope.streamBitrateLists[contentType].length; i++) {
            let j = streamInfo.periodIndex;
            if ($scope.streamBitrateLists[contentType][i][j]) {
                for (let jj = 0; jj < $scope.streamBitrateLists[contentType][i][j].length; jj++) {
                    if ($scope.streamBitrateLists[contentType][i][j][jj]) {
                        for (let jjj = 0; jjj < $scope.streamBitrateLists[contentType][i][j][jj].length; jjj++) {
                            if ($scope.streamBitrateLists[contentType][i][j][jj][jjj].bandwidth != undefined) {
                                if (!firstsmall) {
                                    firstsmall = {
                                        pathIndex: i,
                                        periodIndex: j,
                                        adaptationSetIndex: jj,
                                        representationIndex: jjj,
                                        bandwidth: $scope.streamBitrateLists[contentType][i][j][jj][jjj].bandwidth
                                    };
                                } else if (firstsmall && !secondsmall) {
                                    if ($scope.streamBitrateLists[contentType][i][j][jj][jjj].bandwidth < firstsmall.bandwidth) {
                                        secondsmall = firstsmall;
                                        firstsmall = {
                                            pathIndex: i,
                                            periodIndex: j,
                                            adaptationSetIndex: jj,
                                            representationIndex: jjj,
                                            bandwidth: $scope.streamBitrateLists[contentType][i][j][jj][jjj].bandwidth
                                        };
                                    } else if ($scope.streamBitrateLists[contentType][i][j][jj][jjj].bandwidth > firstsmall.bandwidth) {
                                        secondsmall = {
                                            pathIndex: i,
                                            periodIndex: j,
                                            adaptationSetIndex: jj,
                                            representationIndex: jjj,
                                            bandwidth: $scope.streamBitrateLists[contentType][i][j][jj][jjj].bandwidth
                                        };
                                    }
                                } else if (!firstsmall && secondsmall) {
                                    window.alert("Error when using LowestBitrateRule!");
                                    return streamInfo;
                                } else {
                                    if ($scope.streamBitrateLists[contentType][i][j][jj][jjj].bandwidth < firstsmall.bandwidth) {
                                        secondsmall = firstsmall;
                                        firstsmall = {
                                            pathIndex: i,
                                            periodIndex: j,
                                            adaptationSetIndex: jj,
                                            representationIndex: jjj,
                                            bandwidth: $scope.streamBitrateLists[contentType][i][j][jj][jjj].bandwidth
                                        };
                                    } else if ($scope.streamBitrateLists[contentType][i][j][jj][jjj].bandwidth > firstsmall.bandwidth && $scope.streamBitrateLists[contentType][i][j][jj][jjj].bandwidth < secondsmall.bandwidth) {
                                        secondsmall = {
                                            pathIndex: i,
                                            periodIndex: j,
                                            adaptationSetIndex: jj,
                                            representationIndex: jjj,
                                            bandwidth: $scope.streamBitrateLists[contentType][i][j][jj][jjj].bandwidth
                                        };
                                    }
                                }
                            }
                        }
                    }
                }     
            }
        }
        if ($scope.lifeSignalEnabled && secondsmall) {
            streamInfo.pathIndex = secondsmall.pathIndex;
            streamInfo.periodIndex = secondsmall.periodIndex;
            streamInfo.adaptationSetIndex = secondsmall.adaptationSetIndex;
            streamInfo.representationIndex = secondsmall.representationIndex;
        }
        if (!$scope.lifeSignalEnabled && firstsmall) {
            streamInfo.pathIndex = firstsmall.pathIndex;
            streamInfo.periodIndex = firstsmall.periodIndex;
            streamInfo.adaptationSetIndex = firstsmall.adaptationSetIndex;
            streamInfo.representationIndex = firstsmall.representationIndex;
        }

        return streamInfo;
        
    }

    instance = {
        setStreamInfo: setStreamInfo
    };

    setup();

    return instance;
}