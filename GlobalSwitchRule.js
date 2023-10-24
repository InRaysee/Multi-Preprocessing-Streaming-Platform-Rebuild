// Rule that manually selects the bitrate
var GlobalSwitchRuleClass = function () {

    let instance;
    let appElement = document.querySelector('[ng-controller=DashController]');
    let $scope = window.angular ? window.angular.element(appElement).scope() : undefined;

    let bitrateList = {
        video: [],
        audio: []
    };

    // Always manually select the bitrate
    function setStreamInfo(streamInfo, contentType) {

        if ($scope.mode == "CMP") {
            window.alert("Cannot use GlobalSwitchRule when playing CMP mode!");
            return;
        }
        
        if (!$scope.streamBitrateList || !$scope.streamBitrateList[contentType]) {
            return streamInfo;
        }

        // Renew the bitrate list of the current content type (A - Z)
        bitrateList[contentType] = [];
        for (let i = 0; i < $scope.streamBitrateList[contentType].length; i++) {
            let j = streamInfo.periodIndex;
            if ($scope.streamBitrateList[contentType][i] && $scope.streamBitrateList[contentType][i][j]) {
                for (let jj = 0; jj < $scope.streamBitrateList[contentType][i][j].length; jj++) {
                    if ($scope.streamBitrateList[contentType][i][j][jj]) {
                        for (let jjj = 0; jjj < $scope.streamBitrateList[contentType][i][j][jj].length; jjj++) {
                            if ($scope.streamBitrateList[contentType][i][j][jj][jjj].bandwidth != undefined) {
                                let curIndexes = {
                                    pathIndex: i,
                                    periodIndex: j,
                                    adaptationSetIndex: jj,
                                    representationIndex: jjj
                                };
                                let curBandwidth = $scope.streamBitrateList[contentType][i][j][jj][jjj].bandwidth;
                                if (bitrateList[contentType].length == 0) {
                                    bitrateList[contentType].push({
                                        indexes: [curIndexes],
                                        bandwidth: curBandwidth
                                    });
                                } else {
                                    let k = 0;
                                    while (k < bitrateList[contentType].length) {
                                        if (bitrateList[contentType][k].bandwidth == curBandwidth) {
                                            bitrateList[contentType][k].indexes.push(curIndexes);
                                            break;
                                        }
                                        k++;
                                    }
                                    if (k == bitrateList[contentType].length) {
                                        let kk = 0;
                                        while (kk < bitrateList[contentType].length) {
                                            if (bitrateList[contentType][kk].bandwidth > curBandwidth) {
                                                bitrateList[contentType].splice(kk, 0, {
                                                    indexes: [curIndexes],
                                                    bandwidth: curBandwidth
                                                });
                                                break;
                                            }
                                            kk++;
                                        }
                                        if (kk == bitrateList[contentType].length) {
                                            bitrateList[contentType].push({
                                                indexes: [curIndexes],
                                                bandwidth: curBandwidth
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    }
                }     
            }
        }

        // Adjust the selected global quality according to length of bitrate lists and life-signal settings
        if ($scope.globalQuality[contentType] < 0) {
            $scope.globalQuality[contentType] = 0;
        }
        if ($scope.globalQuality[contentType] >= bitrateList[contentType].length - 1) {
            $scope.globalQuality[contentType] = bitrateList[contentType].length - 1;
        }

        // Select the first choice in the list with the same bandwidth
        streamInfo.pathIndex = bitrateList[contentType][$scope.globalQuality[contentType]].indexes[0].pathIndex;
        streamInfo.periodIndex = bitrateList[contentType][$scope.globalQuality[contentType]].indexes[0].periodIndex;
        streamInfo.adaptationSetIndex = bitrateList[contentType][$scope.globalQuality[contentType]].indexes[0].adaptationSetIndex;
        streamInfo.representationIndex = bitrateList[contentType][$scope.globalQuality[contentType]].indexes[0].representationIndex;
        streamInfo.mimeCodecs = $scope.streamBitrateList[contentType][streamInfo.pathIndex][streamInfo.periodIndex][streamInfo.adaptationSetIndex][streamInfo.representationIndex].mimeCodecs;
        streamInfo.baseUrl = $scope.streamMpds[contentType][streamInfo.pathIndex].baseUrl;

        return streamInfo;

    }

    instance = {
        setStreamInfo: setStreamInfo
    };

    return instance;

};