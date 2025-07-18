// Rule that selects the possible highest bitrate
var HighestBitrateRuleClass = function () {

    let instance;
    let appElement = document.querySelector('[ng-controller=DashController]');
    let $scope = window.angular ? window.angular.element(appElement).scope() : undefined;

    // Always select the highest bitrate
    function setStreamInfo(streamInfo, contentType) {
        
        if (!$scope.streamBitrateList || !$scope.streamBitrateList[contentType]) {
            return streamInfo;
        }

        for (let i = 0; i < $scope.streamBitrateList[contentType].length; i++) {
            if ($scope.mode != "CMP" || i == streamInfo.pathIndex) {
                let j = streamInfo.periodIndex;
                if ($scope.streamBitrateList[contentType][i] && $scope.streamBitrateList[contentType][i][j]) {
                    for (let jj = 0; jj < $scope.streamBitrateList[contentType][i][j].length; jj++) {
                        if ($scope.streamBitrateList[contentType][i][j][jj]) {
                            for (let jjj = 0; jjj < $scope.streamBitrateList[contentType][i][j][jj].length; jjj++) {
                                if ($scope.streamBitrateList[contentType][i][j][jj][jjj].bandwidth != undefined && $scope.streamBitrateList[contentType][i][j][jj][jjj].bandwidth > $scope.streamBitrateList[contentType][streamInfo.pathIndex][streamInfo.periodIndex][streamInfo.adaptationSetIndex][streamInfo.representationIndex].bandwidth) {
                                    streamInfo.pathIndex = i;
                                    streamInfo.periodIndex = j;
                                    streamInfo.adaptationSetIndex = jj;
                                    streamInfo.representationIndex = jjj;
                                    streamInfo.mimeCodecs = $scope.streamBitrateList[contentType][streamInfo.pathIndex][streamInfo.periodIndex][streamInfo.adaptationSetIndex][streamInfo.representationIndex].mimeCodecs;
                                    streamInfo.baseUrl = $scope.streamMpds[contentType][streamInfo.pathIndex].baseUrl;
                                }
                                if ($scope.streamBitrateList[contentType][i][j][jj][jjj].bandwidth != undefined && $scope.streamBitrateList[contentType][i][j][jj][jjj].bandwidth == $scope.streamBitrateList[contentType][streamInfo.pathIndex][streamInfo.periodIndex][streamInfo.adaptationSetIndex][streamInfo.representationIndex].bandwidth 
                                    && $scope.monitorRtt && $scope.monitorRtt[contentType] && !isNaN($scope.monitorRtt[contentType][i]) && !isNaN($scope.monitorRtt[contentType][streamInfo.pathIndex]) && $scope.monitorRtt[contentType][i] < $scope.monitorRtt[contentType][streamInfo.pathIndex]) {
                                    streamInfo.pathIndex = i;
                                    streamInfo.periodIndex = j;
                                    streamInfo.adaptationSetIndex = jj;
                                    streamInfo.representationIndex = jjj;
                                    streamInfo.mimeCodecs = $scope.streamBitrateList[contentType][streamInfo.pathIndex][streamInfo.periodIndex][streamInfo.adaptationSetIndex][streamInfo.representationIndex].mimeCodecs;
                                    streamInfo.baseUrl = $scope.streamMpds[contentType][streamInfo.pathIndex].baseUrl;
                                }
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