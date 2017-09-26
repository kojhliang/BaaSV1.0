/*
Navicat MySQL Data Transfer

Source Server         : 172.17.21.59
Source Server Version : 50626
Source Host           : 172.17.21.59:3306
Source Database       : explorer_test

Target Server Type    : MYSQL
Target Server Version : 50626
File Encoding         : 65001

Date: 2017-09-20 13:45:18
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
  PRIMARY KEY (`pk_Id`)
) ENGINE=InnoDB AUTO_INCREMENT=141 DEFAULT CHARSET=utf8 COMMENT='管道表';

-- ----------------------------
-- Records of channel
-- ----------------------------
INSERT INTO `channel` VALUES ('91', 'mychannel', 'org1.peer1,org1.peer2;org2.peer1,org2.peer2', 'org1,org2', null);
INSERT INTO `channel` VALUES ('101', 'bbchannel', 'org1.peer1,org1.peer2;org2.peer1,org2.peer2', 'org1,org2', null);
INSERT INTO `channel` VALUES ('111', 'ccchannel', 'org1.peer1,org1.peer2;org2.peer1,org2.peer2', 'org1,org2', null);
INSERT INTO `channel` VALUES ('121', 'qqchannel', 'org1.peer1,org1.peer2;org2.peer1,org2.peer2', 'org1,org2', null);
INSERT INTO `channel` VALUES ('131', 'wwchannel', 'org1.peer1,org1.peer2;org2.peer1,org2.peer2', 'org1,org2', null);

-- ----------------------------
-- Table structure for channel_org
-- ----------------------------
DROP TABLE IF EXISTS `channel_org`;
CREATE TABLE `channel_org` (
  `channelId` int(11) DEFAULT NULL COMMENT '管道ID',
  `orgId` int(11) DEFAULT NULL COMMENT '组织ID'
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT='管道和组织的关系表';

-- ----------------------------
-- Records of channel_org
-- ----------------------------
INSERT INTO `channel_org` VALUES ('4', '1');
INSERT INTO `channel_org` VALUES ('2', '1');
INSERT INTO `channel_org` VALUES ('3', '1');

-- ----------------------------
-- Table structure for channel_peernode
-- ----------------------------
DROP TABLE IF EXISTS `channel_peernode`;
CREATE TABLE `channel_peernode` (
  `channelId` int(11) DEFAULT NULL COMMENT '管道ID',
  `peernodeID` int(11) DEFAULT NULL COMMENT 'peernode节点ID'
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT='管道和peer节点的关系表';

-- ----------------------------
-- Records of channel_peernode
-- ----------------------------
INSERT INTO `channel_peernode` VALUES ('4', '11');
INSERT INTO `channel_peernode` VALUES ('4', '21');
INSERT INTO `channel_peernode` VALUES ('2', '11');
INSERT INTO `channel_peernode` VALUES ('3', '1');
INSERT INTO `channel_peernode` VALUES ('3', '2');
INSERT INTO `channel_peernode` VALUES ('3', '3');

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
  PRIMARY KEY (`pk_Id`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8 COMMENT='部署的智能合约表，实际上是实例表,先产生实例，然后通过安装，初始化或者升级产生智能合约ID';

-- ----------------------------
-- Records of deploychaincode
-- ----------------------------
INSERT INTO `deploychaincode` VALUES ('1', 'testcc', null, '4', '111', '', null, null, null, '1000', null);
INSERT INTO `deploychaincode` VALUES ('11', 'testcc', null, '1000', '111', '1,2,3,4,5,6,7', null, null, null, null, null);

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
  PRIMARY KEY (`pk_Id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT='日志表';

-- ----------------------------
-- Records of log
-- ----------------------------

-- ----------------------------
-- Table structure for org
-- ----------------------------
DROP TABLE IF EXISTS `org`;
CREATE TABLE `org` (
  `pk_Id` int(11) NOT NULL AUTO_INCREMENT COMMENT '组织ID',
  `orgName` varchar(255) DEFAULT NULL COMMENT '组织名',
  `includePeers` text COMMENT '包含的peer节点列表',
  `peerNum` int(11) DEFAULT NULL COMMENT '包含的节点数（方便前台显示）',
  PRIMARY KEY (`pk_Id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8 COMMENT='组织表';

-- ----------------------------
-- Records of org
-- ----------------------------
INSERT INTO `org` VALUES ('1', 'org1', 'org1.peer1,org1.peer2', '2');
INSERT INTO `org` VALUES ('2', 'org2', 'org2.peer1,org2.peer2', '2');

-- ----------------------------
-- Table structure for peernode
-- ----------------------------
DROP TABLE IF EXISTS `peernode`;
CREATE TABLE `peernode` (
  `pk_Id` int(11) NOT NULL AUTO_INCREMENT COMMENT '节点ID',
  `PeerName` varchar(255) DEFAULT NULL COMMENT '节点名',
  `Ip` varchar(255) DEFAULT NULL COMMENT 'peer容器Ip',
  `ContainerId` varchar(255) DEFAULT NULL COMMENT '容器ID',
  `fk_org_Id` int(11) DEFAULT NULL COMMENT '所属组织ID（新增字段）',
  `Online` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`pk_Id`)
) ENGINE=InnoDB AUTO_INCREMENT=51 DEFAULT CHARSET=utf8 COMMENT='peer节点表';

-- ----------------------------
-- Records of peernode
-- ----------------------------
INSERT INTO `peernode` VALUES ('11', 'peer1.org2.example.com', '172.17.21.190', '4dad17315b5cbb3bad07e0538fa87b4ec23623105c81e86e5c768c4d1543af11', '2', '1');
INSERT INTO `peernode` VALUES ('21', 'peer1.org1.example.com', '172.17.21.190', 'd4337c385f601434f86e9661039b490b2141acb3af38300bf2bc69e85f0a511e', '1', '1');
INSERT INTO `peernode` VALUES ('31', 'peer0.org2.example.com', '172.17.21.190', '914232bc94c5580a6c29629b84e9552901c3e884bb0b5058b8bb6593ec306070', '2', '1');
INSERT INTO `peernode` VALUES ('41', 'peer0.org1.example.com', '172.17.21.190', 'ba5f3df8c2556d0ea2930166034e561fc821ec38109e7c1447f2e84d8a34c47f', '1', '1');

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
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8 COMMENT='用户上传或者平台自带的智能合约代码表';

-- ----------------------------
-- Records of uploadchaincode
-- ----------------------------
INSERT INTO `uploadchaincode` VALUES ('1', '转账示例', 'github.com/hyperledger/fabric/examples/chaincode/go/chaincode_example02', '', 'example2', '初始化两个用户的账户和余额，实现相互转账');
INSERT INTO `uploadchaincode` VALUES ('2', '通用数据存储', 'user_chaincode', '/opt/fabric-0.6/unzip/map', 'map', '实现key value形式的通用数据存储');
