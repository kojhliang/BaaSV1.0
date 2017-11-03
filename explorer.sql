/*
Navicat MySQL Data Transfer

Source Server         : localhost
Source Server Version : 50622
Source Host           : localhost:3306
Source Database       : explorer_lmh

Target Server Type    : MYSQL
Target Server Version : 50622
File Encoding         : 65001

Date: 2017-11-03 16:26:19
*/

SET FOREIGN_KEY_CHECKS=0;

-- ----------------------------
-- Table structure for channel
-- ----------------------------
DROP TABLE IF EXISTS `channel`;
CREATE TABLE `channel` (
  `pk_Id` int(11) NOT NULL AUTO_INCREMENT COMMENT '管道ID',
  `channelName` varchar(255) DEFAULT NULL COMMENT '管道名',
  `joinPeers` text COMMENT '加入管道的节点列表，形如 组织名.peer名, 组织名.peer名 的格式',
  `includeOrgs` text COMMENT '包含的组织列表',
  `createTime` datetime DEFAULT NULL COMMENT '创建时间',
  `isOk` tinyint(4) DEFAULT NULL,
  PRIMARY KEY (`pk_Id`)
) ENGINE=InnoDB AUTO_INCREMENT=40 DEFAULT CHARSET=utf8 COMMENT='管道表';

-- ----------------------------
-- Records of channel
-- ----------------------------
INSERT INTO `channel` VALUES ('38', 'mychannel', 'org1.peer1;org1.peer2', 'org1', '2017-10-31 11:34:51', '1');
INSERT INTO `channel` VALUES ('39', 'kkchannel', 'org2.peer2;org2.peer1', 'org2', '2017-10-31 11:37:32', '1');

-- ----------------------------
-- Table structure for channel_org
-- ----------------------------
DROP TABLE IF EXISTS `channel_org`;
CREATE TABLE `channel_org` (
  `channelId` int(11) NOT NULL COMMENT '管道ID',
  `orgId` int(11) NOT NULL COMMENT '组织ID',
  PRIMARY KEY (`channelId`,`orgId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT='管道和组织的关系表';

-- ----------------------------
-- Records of channel_org
-- ----------------------------
INSERT INTO `channel_org` VALUES ('38', '32');
INSERT INTO `channel_org` VALUES ('39', '33');

-- ----------------------------
-- Table structure for channel_peernode
-- ----------------------------
DROP TABLE IF EXISTS `channel_peernode`;
CREATE TABLE `channel_peernode` (
  `channelId` int(11) NOT NULL COMMENT '管道ID',
  `peernodeID` int(11) NOT NULL COMMENT 'peernode节点ID',
  PRIMARY KEY (`channelId`,`peernodeID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT='管道和peer节点的关系表';

-- ----------------------------
-- Records of channel_peernode
-- ----------------------------
INSERT INTO `channel_peernode` VALUES ('38', '23');
INSERT INTO `channel_peernode` VALUES ('38', '24');
INSERT INTO `channel_peernode` VALUES ('39', '21');
INSERT INTO `channel_peernode` VALUES ('39', '22');

-- ----------------------------
-- Table structure for deploychaincode
-- ----------------------------
DROP TABLE IF EXISTS `deploychaincode`;
CREATE TABLE `deploychaincode` (
  `pk_Id` int(11) NOT NULL AUTO_INCREMENT COMMENT '实例ID',
  `ChaincodeName` varchar(255) DEFAULT NULL COMMENT '合约名,即新版本的实例名',
  `ChaincodeType` varchar(255) DEFAULT NULL COMMENT '合约类型,分平台 和用户上传',
  `channelId` int(11) DEFAULT NULL COMMENT '安装的管道ID(新增的字段)',
  `version` varchar(255) DEFAULT NULL COMMENT '版本号(新增的字段)',
  `installPeers` text COMMENT '安装的peer节点列表(新增的字段)',
  `fk_uploadchaincode_Id` int(11) DEFAULT NULL COMMENT '用户上传或平台自带的智能合约代码ID',
  `Params` text COMMENT '初始化参数',
  `endorsePolicy` text COMMENT '背书策略(新增的字段)',
  `ChaincodeId` varchar(255) DEFAULT NULL COMMENT '部署智能合约成功后的智能合约实例ID',
  `Description` text COMMENT '描述',
  `Status` varchar(255) DEFAULT '0' COMMENT '0为未安装，未初始化，1为已经初始化，2为已安装，已初始化，可升级',
  PRIMARY KEY (`pk_Id`)
) ENGINE=InnoDB AUTO_INCREMENT=74 DEFAULT CHARSET=utf8 COMMENT='部署的智能合约表，实际上是实例表,先产生实例，然后通过安装，初始化或者升级产生智能合约ID';

-- ----------------------------
-- Records of deploychaincode
-- ----------------------------
INSERT INTO `deploychaincode` VALUES ('65', 'qwe1', null, '32', '1', '21,22,23,24', '2', '1', 'undefined', null, null, '2');
INSERT INTO `deploychaincode` VALUES ('66', 'asd45', null, '33', '1', '22', '2', 'a', 'undefined', null, null, '2');
INSERT INTO `deploychaincode` VALUES ('67', 'zx789', null, '34', '2222', '21,21', '2', 'a', '', null, null, '2');
INSERT INTO `deploychaincode` VALUES ('68', 'asd12yy', null, '35', '11', '21,24', '2', 'zxc', 'undefined', null, null, '2');
INSERT INTO `deploychaincode` VALUES ('69', 'zxc12312312', null, '36', '123', '23,21', '2', 'a', 'undefined', null, null, '1');
INSERT INTO `deploychaincode` VALUES ('70', 'fdg123', null, '37', '11', '21', '2', 'd', 'undefined', null, null, '2');
INSERT INTO `deploychaincode` VALUES ('71', 'testChannel', null, '32', '1', '23,24', '2', 'x', 'undefined', null, null, '2');
INSERT INTO `deploychaincode` VALUES ('72', 'test1', null, '38', 'v1.0', '23,24', '2', 'd', 'undefined', null, null, '2');
INSERT INTO `deploychaincode` VALUES ('73', 'test2', null, '39', 'v1.0', '21,22', '2', 'c', 'undefined', null, null, '2');

-- ----------------------------
-- Table structure for log
-- ----------------------------
DROP TABLE IF EXISTS `log`;
CREATE TABLE `log` (
  `pk_Id` int(11) NOT NULL AUTO_INCREMENT COMMENT '日志ID',
  `operation` varchar(50) DEFAULT NULL COMMENT '操作类型:分add_channel,edit_channel,invoke,install,Instantiate,upgrade',
  `params` text COMMENT '输入参数',
  `transactionId` varchar(255) DEFAULT NULL COMMENT '事务记录ID',
  `chaincodeId` varchar(255) DEFAULT NULL COMMENT '智能合约ID',
  `userName` varchar(255) DEFAULT NULL COMMENT '操作的用户名',
  `createTime` datetime DEFAULT NULL COMMENT '产生的时间',
  `channelId` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`pk_Id`)
) ENGINE=InnoDB AUTO_INCREMENT=33 DEFAULT CHARSET=utf8 COMMENT='日志表';

-- ----------------------------
-- Records of log
-- ----------------------------
INSERT INTO `log` VALUES ('21', '创建管道', '', '', '', '', '2017-10-24 10:41:20', 'mychannel');
INSERT INTO `log` VALUES ('22', '部署合约', '(mycc1:v0,init,a,100,b,200)', 'a029e7d2f3c58413c9c46cc878f2c24c5a37a3438f3610985559fc3d5e0cf246', 'mycc1:v0', '', '2017-10-24 10:41:36', 'mychannel');
INSERT INTO `log` VALUES ('23', '执行合约', '(a,b,10)', 'a0b76af587459b770965df49b161fafd7e312f49d78a4b1add83ab154449e5e9', 'mycc1:v0', '', '2017-10-24 10:43:03', 'mychannel');
INSERT INTO `log` VALUES ('24', '执行合约', '(a,b,10)', 'd59dd38f24bada7e6314dc28cf5982962ac0a5c8399eb57e49bd0f7ee2fc18cd', 'mycc1:v0', '', '2017-10-24 10:43:07', 'mychannel');
INSERT INTO `log` VALUES ('25', '升级合约', '(mycc1:v1,init,a,300,b,500)', '16a7373391248e270993e36aa7831d940dc81a8934313c7bb13781e7e2f7a620', 'mycc1:v1', '', '2017-10-24 10:43:10', 'mychannel');
INSERT INTO `log` VALUES ('26', '创建管道', '', '', '', '', '2017-10-24 10:47:37', 'mmchannel');
INSERT INTO `log` VALUES ('27', '部署合约', '(mycc1:v0,init,a,100,b,200)', 'e46e2794212c84aaf327184faad0bca4f393dc0c4a85c1f01e0109f7d311f01e', 'mycc1:v0', '', '2017-10-24 10:47:53', 'mmchannel');
INSERT INTO `log` VALUES ('28', '执行合约', '(a,b,10)', '315a39afbb3e8813e359952884875684599f54360401b50c4408d6d03a5ed77c', 'mycc1:v0', '', '2017-10-24 10:48:05', 'mmchannel');
INSERT INTO `log` VALUES ('29', '执行合约', '(a,b,10)', 'f2e023607bcb4014e48445e7fd1d62e83b5bff28d15b44d0eee0bace37308972', 'mycc1:v0', '', '2017-10-24 10:48:09', 'mmchannel');
INSERT INTO `log` VALUES ('30', '升级合约', '(mycc1:v1,init,a,300,b,500)', '407426cdcd87c1e759ba5bfe9e11fac6cd328d1f15633fe630ddd732d721cb36', 'mycc1:v1', '', '2017-10-24 10:48:12', 'mmchannel');
INSERT INTO `log` VALUES ('31', '创建管道', '', '', '', '', '2017-10-24 10:59:58', 'kkchannel');
INSERT INTO `log` VALUES ('32', '创建管道', '', '', '', '', '2017-10-24 21:35:39', 'ggchannel');

-- ----------------------------
-- Table structure for org
-- ----------------------------
DROP TABLE IF EXISTS `org`;
CREATE TABLE `org` (
  `pk_Id` int(11) NOT NULL AUTO_INCREMENT COMMENT '组织ID',
  `orgName` varchar(255) NOT NULL COMMENT '组织名',
  `includePeers` text COMMENT '包含的peer节点列表',
  `peerNum` int(11) DEFAULT NULL COMMENT '包含的节点数（方便前台显示）',
  PRIMARY KEY (`pk_Id`,`orgName`),
  UNIQUE KEY `orgName` (`orgName`)
) ENGINE=InnoDB AUTO_INCREMENT=36 DEFAULT CHARSET=utf8 COMMENT='组织表';

-- ----------------------------
-- Records of org
-- ----------------------------
INSERT INTO `org` VALUES ('32', 'org1', null, null);
INSERT INTO `org` VALUES ('33', 'org2', null, null);

-- ----------------------------
-- Table structure for peernode
-- ----------------------------
DROP TABLE IF EXISTS `peernode`;
CREATE TABLE `peernode` (
  `pk_Id` int(11) NOT NULL AUTO_INCREMENT COMMENT '节点ID',
  `PeerName` varchar(255) DEFAULT NULL COMMENT '节点名',
  `Ip` varchar(255) DEFAULT NULL COMMENT 'peer容器Ip',
  `Online` tinyint(1) DEFAULT NULL COMMENT '是否在线，1为在线，0为离线',
  `ContainerId` varchar(255) DEFAULT NULL COMMENT '容器ID',
  `fk_org_Id` int(11) DEFAULT NULL COMMENT '所属组织ID（新增字段）',
  `PeerId` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`pk_Id`)
) ENGINE=InnoDB AUTO_INCREMENT=25 DEFAULT CHARSET=utf8 COMMENT='peer节点表';

-- ----------------------------
-- Records of peernode
-- ----------------------------
INSERT INTO `peernode` VALUES ('21', 'peer1.org2.example.com', '172.17.16.77', '1', 'f5b228454ad4454d4f4deb22f012dd2ff3c6874d08e1992b67fc1468ee266f6d', '33', 'peer2');
INSERT INTO `peernode` VALUES ('22', 'peer0.org2.example.com', '172.17.16.77', '1', 'bc78b971122d854b225563fb4ca26f48ba5f1cdd6b1b0453ba2d49753cb9f438', '33', 'peer1');
INSERT INTO `peernode` VALUES ('23', 'peer0.org1.example.com', '172.17.16.77', '1', '3e3a0aaa13ffe278fec23b97eabd5050926de0196204ef4e2fc092f807700b6f', '32', 'peer1');
INSERT INTO `peernode` VALUES ('24', 'peer1.org1.example.com', '172.17.16.77', '1', '808b3ec73e1c0c6f2fc23c7d1cf50b10827191c803fffa7dd17ab1125176eb49', '32', 'peer2');

-- ----------------------------
-- Table structure for uploadchaincode
-- ----------------------------
DROP TABLE IF EXISTS `uploadchaincode`;
CREATE TABLE `uploadchaincode` (
  `pk_Id` int(11) NOT NULL AUTO_INCREMENT COMMENT '用户上传或平台自带的智能合约代码ID',
  `name` varchar(255) DEFAULT NULL COMMENT '合约名字',
  `MainPath` varchar(255) DEFAULT NULL COMMENT '主函数路径',
  `UploadPath` varchar(255) DEFAULT NULL COMMENT '上传路径',
  `ChaincodeType` varchar(255) DEFAULT NULL COMMENT '智能合约类型：有example2，map，userUpload',
  `Description` varchar(255) DEFAULT NULL COMMENT '描述',
  PRIMARY KEY (`pk_Id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8 COMMENT='用户上传或者平台自带的智能合约代码表';

-- ----------------------------
-- Records of uploadchaincode
-- ----------------------------
INSERT INTO `uploadchaincode` VALUES ('1', '转账示例', 'github.com/chaincode_example02', '', 'example2', '初始化两个用户的账户和余额，实现相互转账');
INSERT INTO `uploadchaincode` VALUES ('2', '通用数据存储', 'github.com/map', '/opt/fabric-0.6/unzip/map', 'map', '实现key value形式的通用数据存储');
INSERT INTO `uploadchaincode` VALUES ('3', 'qwe123', 'user_chaincode', '/usr/local/unzip/1508916518', 'userUpload', '123123');
