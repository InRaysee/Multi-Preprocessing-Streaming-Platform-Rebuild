// Rule that selects the possible bitrate based on throughput
var RttThroughputRuleClass = function () {

    let instance;
    var appElement = document.querySelector('[ng-controller=DashController]');
    var $scope = window.angular ? window.angular.element(appElement).scope() : undefined;

    const THROUGHPUT_BIAS = 0.1;

    let bitrateList = {
        video: [],
        audio: []
    };

    // Always select the possible bitrate based on throughput
    function setStreamInfo(streamInfo, contentType) {

        if (!$scope.streamBitrateList || !$scope.streamBitrateList[contentType]) {
            return streamInfo;
        }

        // Renew the bitrate list of the current content type (A - Z)
        bitrateList[contentType] = [];
        for (let i = 0; i < $scope.streamBitrateList[contentType].length; i++) {
            if ($scope.mode != "CMP" || i == streamInfo.pathIndex) {
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
        }

        // Select quality according to throughput
        let bandwidth = $scope.streamBitrateList[contentType][streamInfo.pathIndex][streamInfo.periodIndex][streamInfo.adaptationSetIndex][streamInfo.representationIndex].bandwidth;
        let targetQuality = NaN;
        for (let i = 0; i < bitrateList[contentType].length; i++) {
            if (bitrateList[contentType][i].bandwidth == bandwidth) {
                targetQuality = i;
                break;
            }            
        }
        if (isNaN(targetQuality)) {
            console.log("Error when using RttThroughputRule: no original bandwidtth in the bitrate list!");
            return streamInfo;
        }
        if ($scope.monitorThroughput[contentType][streamInfo.pathIndex] < $scope.monitorThroughputExpect[contentType][streamInfo.pathIndex] * (1 - THROUGHPUT_BIAS)) {
            targetQuality = Math.max(0, targetQuality - 1);
        }
        if ($scope.monitorThroughput[contentType][streamInfo.pathIndex] > $scope.monitorThroughputExpect[contentType][streamInfo.pathIndex] * (1 + THROUGHPUT_BIAS)) {
            targetQuality = Math.min(bitrateList[contentType].length - 1, targetQuality + 1);
        }

        // Choose the path according to RTT
        let targetPath = 0;
        if ($scope.monitorRtt && $scope.monitorRtt[contentType] && $scope.monitorRtt[contentType].length > 0) {
            for (let i = 1; i < bitrateList[contentType][targetQuality].indexes.length; i++) {
                if (!isNaN($scope.monitorRtt[contentType][bitrateList[contentType][targetQuality].indexes[targetPath].pathIndex]) && !isNaN($scope.monitorRtt[contentType][bitrateList[contentType][targetQuality].indexes[i].pathIndex]) 
                    && $scope.monitorRtt[contentType][bitrateList[contentType][targetQuality].indexes[i].pathIndex] < $scope.monitorRtt[contentType][bitrateList[contentType][targetQuality].indexes[targetPath].pathIndex]) {
                    targetPath = i;
                }
            }
        }

        // Select the first choice in the list with the same bandwidth
        streamInfo.pathIndex = bitrateList[contentType][targetQuality].indexes[targetPath].pathIndex;
        streamInfo.periodIndex = bitrateList[contentType][targetQuality].indexes[targetPath].periodIndex;
        streamInfo.adaptationSetIndex = bitrateList[contentType][targetQuality].indexes[targetPath].adaptationSetIndex;
        streamInfo.representationIndex = bitrateList[contentType][targetQuality].indexes[targetPath].representationIndex;
        streamInfo.mimeCodecs = $scope.streamBitrateList[contentType][streamInfo.pathIndex][streamInfo.periodIndex][streamInfo.adaptationSetIndex][streamInfo.representationIndex].mimeCodecs;
        streamInfo.baseUrl = $scope.streamMpds[contentType][streamInfo.pathIndex].baseUrl;

        return streamInfo;

    }

    instance = {
        setStreamInfo: setStreamInfo
    };

    return instance;

};
