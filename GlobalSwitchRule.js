// Rule that manually selects the bitrate
var GlobalSwitchRuleClass = function () {

    let instance;
    let appElement = document.querySelector('[ng-controller=DashController]');
    let $scope = window.angular ? window.angular.element(appElement).scope() : undefined;

    let bitrateLists = {
        video: [],
        audio: []
    };

    // Always manually select the bitrate
    function setStreamInfo(streamInfo, contentType) {

        if (!$scope.streamBitrateLists || !$scope.streamBitrateLists[contentType]) {
            return streamInfo;
        }

        // Renew the bitrate list of the current content type (A - Z)
        bitrateLists[contentType] = [];
        for (let i = 0; i < $scope.streamBitrateLists[contentType].length; i++) {
            let j = streamInfo.periodIndex;
            if ($scope.streamBitrateLists[contentType][i] && $scope.streamBitrateLists[contentType][i][j]) {
                for (let jj = 0; jj < $scope.streamBitrateLists[contentType][i][j].length; jj++) {
                    if ($scope.streamBitrateLists[contentType][i][j][jj]) {
                        for (let jjj = 0; jjj < $scope.streamBitrateLists[contentType][i][j][jj].length; jjj++) {
                            if ($scope.streamBitrateLists[contentType][i][j][jj][jjj].bandwidth != undefined) {
                                let curIndexes = {
                                    pathIndex: i,
                                    periodIndex: j,
                                    adaptationSetIndex: jj,
                                    representationIndex: jjj
                                };
                                let curBandwidth = $scope.streamBitrateLists[contentType][i][j][jj][jjj].bandwidth;
                                if (bitrateLists[contentType].length == 0) {
                                    bitrateLists[contentType].push({
                                        indexes: [curIndexes],
                                        bandwidth: curBandwidth
                                    });
                                } else {
                                    let k = 0;
                                    while (k < bitrateLists[contentType].length) {
                                        if (bitrateLists[contentType][k].bandwidth == curBandwidth) {
                                            bitrateLists[contentType][k].indexes.push(curIndexes);
                                            break;
                                        }
                                        k++;
                                    }
                                    if (k == bitrateLists[contentType].length) {
                                        let kk = 0;
                                        while (kk < bitrateLists[contentType].length) {
                                            if (bitrateLists[contentType][kk].bandwidth > curBandwidth) {
                                                bitrateLists[contentType].splice(kk, 0, {
                                                    indexes: [curIndexes],
                                                    bandwidth: curBandwidth
                                                });
                                                break;
                                            }
                                            kk++;
                                        }
                                        if (kk == bitrateLists[contentType].length) {
                                            bitrateLists[contentType].push({
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
        if ($scope.globalQuality[contentType] >= bitrateLists[contentType].length - 1) {
            $scope.globalQuality[contentType] = bitrateLists[contentType].length - 1;
        }

        // Select the first choice in the list with the same bandwidth
        streamInfo.pathIndex = bitrateLists[contentType][$scope.globalQuality[contentType]].indexes[0].pathIndex;
        streamInfo.periodIndex = bitrateLists[contentType][$scope.globalQuality[contentType]].indexes[0].periodIndex;
        streamInfo.adaptationSetIndex = bitrateLists[contentType][$scope.globalQuality[contentType]].indexes[0].adaptationSetIndex;
        streamInfo.representationIndex = bitrateLists[contentType][$scope.globalQuality[contentType]].indexes[0].representationIndex;
        streamInfo.mimeCodecs = $scope.streamBitrateLists[contentType][streamInfo.pathIndex][streamInfo.periodIndex][streamInfo.adaptationSetIndex][streamInfo.representationIndex].mimeCodecs;
        streamInfo.baseUrl = $scope.streamMpds[contentType][streamInfo.pathIndex].baseUrl;

        return streamInfo;

    }

    instance = {
        setStreamInfo: setStreamInfo
    };

    return instance;

};