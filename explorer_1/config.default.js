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
    //HYP_REST_ENDPOINT:'http://172.17.21.190:4000',
	HYP_REST_ENDPOINT:'http://172.17.16.77:4000',
    //HYP_REST_ENDPOINT:'http://192.168.0.104:4000',
    host: 'localhost',

    //dbhost:'172.17.21.59',
    //user: 'root',
    //password: 'root',
    //database: 'explorer_test',
	
    // dbhost:'localhost',
    // user: 'root',
    // password: 'kojh',
    // database: 'explorer_lmh',
    // username:'jim',
    // orgName:'org1',

    dbhost:'172.17.16.74',
    user: 'root',
    password: 'kojh',
    database: 'explorer_lmh',
    username:'jim',
    orgName:'org1',

    //上传智能合约部分
    uploadFolder:'/usr/local/upload',
    //uploadFolder:'c:\\temp',
    zipFolder : "/usr/local/unzip",
    //十分重要的参数，指定balance-transfer项目里的智能合约的src所在目录
    user_chaincode_Path :"/usr/local/balance-transf-1.0.2/artifacts/src/user_chaincode",
    //user_chaincode_Path :"/home/ucsmy/fabic/balance-transfer-1.0.2/balance-transfer/artifacts/src/user_chaincode"
    //deployFolder : "/data/database/nfs",

    gopath : "/usr/local/gopath",
    goBuildFolder :"/usr/local/goBuild"
};

//如果是生产环境
if (config.debug ==false) {
    config.uploadFolder = '/opt/fabric-1.0/upload';
    config.zipFolder = "/opt/fabric-1.0/unzip";
    config.user_chaincode_Path ="/usr/local/balance-transf-1.0.2/artifacts/src/user_chaincode",

    config.gopath ="/usr/local/gopath",
    //执行go build编译输出的二进制文件，仅仅是为了代码检测，build完没问题可以删掉目录下的文件
    //为了考虑有多个用户同时go builder的情况所以goBuild目录下面要再建子目录进行区分
    config.goBuildFolder ="/opt/fabric-0.6/upload/goBuild";
}

module.exports = config;
