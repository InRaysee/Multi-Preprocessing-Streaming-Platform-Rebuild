// Rule that selects the possible bitrate based on buffer level
var RttBufferRuleClass = function () {

    let instance;
    let appElement = document.querySelector('[ng-controller=DashController]');
    let $scope = window.angular ? window.angular.element(appElement).scope() : undefined;

    let bitrateList = {
        video: [],
        audio: []
    };

    // Always select the possible bitrate based on buffer level
    function setStreamInfo(streamInfo, contentType) {

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

        // Fetch the current buffer level and select quality according to exp function
        let targetQuality = bitrateList[contentType].length - 1;
        let elementBuffered = $scope.getBufferLevel(contentType);
        let expFactor = Math.exp(elementBuffered) - 1;
        let expMax = Math.exp($scope.targetBuffer) - 1;
        let expRange = bitrateList[contentType].length;
        for (let i = 0; i < expRange; i++) {
            if (expFactor >= (expMax / expRange) * i && expFactor < (expMax / expRange) * (i + 1)) {
                targetQuality = i;
                break;
            }
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