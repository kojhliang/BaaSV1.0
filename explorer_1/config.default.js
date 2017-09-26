/**
 * config
 */

var path = require('path');

var config = {
  // debug 为 true 时，用于本地调试
    debug: true,
    neverGetLedgerData:false,
    //端口
    HTTP_PORT:9090,
    //node sdk api地址
    HYP_REST_ENDPOINT:'http://172.17.21.190:4000',
    host: 'localhost',


    dbhost:'172.17.21.59',
    user: 'root',
    password: 'root',
    database: 'explorer_test',
    username:'jim',
    orgName:'org1',


    //upload部分
    uploadFolder:'C://temp',
    zipFolder : "C://zip",
    deployFolder : "/data/database/nfs",
    goBuildFolder :"C://zip//goBuild",
    gopath : "/usr/local/gopath",
    user_chaincode_Path :"/home/ucsmy/fabic/balance-transfer-1.0.2/balance-transfer/artifacts/src/user_chaincode"
};

//如果是生产环境
if (config.debug ==false) {
    config.uploadFolder = '/opt/fabric-0.6/upload';
    config.zipFolder = "/opt/fabric-0.6/unzip";
    config.goBuildFolder ="/opt/fabric-0.6/upload/goBuild";


}

module.exports = config;
