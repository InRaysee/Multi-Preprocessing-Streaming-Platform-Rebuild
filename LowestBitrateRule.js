// Rule that selects the possible lowest bitrate
var LowestBitrateRuleClass = function () {

    let instance;
    let appElement = document.querySelector('[ng-controller=DashController]');
    let $scope = window.angular ? window.angular.element(appElement).scope() : undefined;

    // Always select the lowest bitrate
    function setStreamInfo(streamInfo, contentType) {
        
        if (!$scope.streamBitrateLists || !$scope.streamBitrateLists[contentType]) {
            return streamInfo;
        }

        for (let i = 0; i < $scope.streamBitrateLists[contentType].length; i++) {
            let j = streamInfo.periodIndex;
            if ($scope.streamBitrateLists[contentType][i] && $scope.streamBitrateLists[contentType][i][j]) {
                for (let jj = 0; jj < $scope.streamBitrateLists[contentType][i][j].length; jj++) {
                    if ($scope.streamBitrateLists[contentType][i][j][jj]) {
                        for (let jjj = 0; jjj < $scope.streamBitrateLists[contentType][i][j][jj].length; jjj++) {
                            if ($scope.streamBitrateLists[contentType][i][j][jj][jjj].bandwidth != undefined && $scope.streamBitrateLists[contentType][i][j][jj][jjj].bandwidth < $scope.streamBitrateLists[contentType][streamInfo.pathIndex][streamInfo.periodIndex][streamInfo.adaptationSetIndex][streamInfo.representationIndex].bandwidth) {
                                streamInfo.pathIndex = i;
                                streamInfo.periodIndex = j;
                                streamInfo.adaptationSetIndex = jj;
                                streamInfo.representationIndex = jjj;
                                streamInfo.mimeCodecs = $scope.streamBitrateLists[contentType][streamInfo.pathIndex][streamInfo.periodIndex][streamInfo.adaptationSetIndex][streamInfo.representationIndex].mimeCodecs;
                                streamInfo.baseUrl = $scope.streamMpds[contentType][streamInfo.pathIndex].baseUrl;
                            }
                            if ($scope.streamBitrateLists[contentType][i][j][jj][jjj].bandwidth != undefined && $scope.streamBitrateLists[contentType][i][j][jj][jjj].bandwidth == $scope.streamBitrateLists[contentType][streamInfo.pathIndex][streamInfo.periodIndex][streamInfo.adaptationSetIndex][streamInfo.representationIndex].bandwidth 
                                && $scope.monitorRtt && $scope.monitorRtt[contentType] && !isNaN($scope.monitorRtt[contentType][i]) && !isNaN($scope.monitorRtt[contentType][streamInfo.pathIndex]) && $scope.monitorRtt[contentType][i] < $scope.monitorRtt[contentType][streamInfo.pathIndex]) {
                                streamInfo.pathIndex = i;
                                streamInfo.periodIndex = j;
                                streamInfo.adaptationSetIndex = jj;
                                streamInfo.representationIndex = jjj;
                                streamInfo.mimeCodecs = $scope.streamBitrateLists[contentType][streamInfo.pathIndex][streamInfo.periodIndex][streamInfo.adaptationSetIndex][streamInfo.representationIndex].mimeCodecs;
                                streamInfo.baseUrl = $scope.streamMpds[contentType][streamInfo.pathIndex].baseUrl;
                            }
                        }
                    }
                }     
            }
        }

        return streamInfo;
        
    }

    instance = {
        setStreamInfo: setStreamInfo
    };

    return instance;

};