var express           = require('express');
var blockinfoController   = require('./src/api/v1/blockinfo-server');
var channelController = require('./src/api/v1/channel-server');
var chaincodeController = require('./src/api/v1/chaincode-server');
var logController = require('./src/api/v1/log-server');
var router            = express.Router();
// test
router.get('/test1', blockinfoController.test1);
router.get('/test2/:params1', blockinfoController.test2);
router.post('/test3', blockinfoController.test3);
router.post('/test4/:params1', blockinfoController.test4);
//
/*
区块信息
*/
//通过 数据库，获取所有管道名称
router.get('/channelName', blockinfoController.getChannelName);
//根据 管道名称 和 区块号，查询区块信息
router.get('/channel/:channelName/block/:blockNum', blockinfoController.getBlockByChannelNameAndBlockNum);
//根据 管道名称，查询当前管道信息
router.get('/channel/:channelName', blockinfoController.getChannelByName);
//通过 数据库，获取节点信息 
router.get('/networkpeerData', blockinfoController.getPeer);
//通过 节点，获取该节点所加入的管道
router.get('/peer/:peerId/channel', blockinfoController.getChannelByPeerId);
//根据 节点，启动容器
router.post('/peer/:peerId/start',  blockinfoController.peerStart);
//根据 节点，关闭容器
router.post('/peer/:peerId/stop', blockinfoController.peerStop);
/*
管道
*/
//通过 数据库，获取管道列表
router.get('/channel',  channelController.getChannel);
//根据 管道，获取当前加入节点信息
router.get('/channel/:channelId/peer', channelController.getPeerByChannelId);
//根据 管道，获取当前加入组织信息
router.get('/channel/:channelId/org', channelController.getOrgByChannelId);
//根据 管道，获取当前部署智能合约信息
router.get('/channel/:channelId/installedChaincode', channelController.getInstalledChaincodeByChannelId);
//根据 所选择的节点，创建管道
router.post('/newChannel/:channelName/peer/:peerId', channelController.newChannel);
//通过 数据库，获取组织与其属下节点
router.get('/org/peer', channelController.getOrgAndPeer);


/*
智能合约
*/
//通过 数据库，获取合约列表
router.get('/chaincode', chaincodeController.getChaincode);
//根据 所选择管道 和输入的实例，创建实例
router.post('/newDeployChaincode/channel/:channelId/chaincode/:chaincodeName/:chaincodeVersion/:uploadchaincode_Id', chaincodeController.newDeployChaincode);
//通过 数据库，获取 实例列表
router.get('/deployChaincode', chaincodeController.getDeployChaincode);
//根据 所选择的节点 和实例，安装实例到节点上
router.post('/installChaincode/:deployChaincodeId/peer/:peerId', chaincodeController.installChaincode);
//根据 参数 和背书策略，初始化合约
router.post('/initiateChaincode/:deployChaincodeId/param/:param/policy/:policy', chaincodeController.initiateChaincode);
//根据 选择新合约，更新
router.post('/upgradeChaincode/:deployChaincodeId/newChaincode/:newChaincodeId/param/:param', chaincodeController.upgradeChaincode);
/*
操作日志
*/
//通过 数据库，获取日志列表
router.get('/getLogList', logController.getLogList);
module.exports = router;