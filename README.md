
**Note:** This is a **read-only mirror** of the formal [Gerrit](https://gerrit.hyperledger.org/r/#/admin/projects/blockchain-explorer) repository,
where active development is ongoing. Issue tracking is handled in [Jira](https://jira.hyperledger.org/secure/RapidBoard.jspa?projectKey=FAB&rapidView=5&view=planning)

## Incubation Notice

This project is a Hyperledger project in _Incubation_. It was proposed to the
community and documented [here](https://docs.google.com/document/d/1Z8uR_w9E9XITEe88PzkLjzH9t5bPivUhQO8OiEP7s_U/edit). 
Information on what _Incubation_ entails can be found in the [Hyperledger Project Lifecycle
document](https://goo.gl/4edNRc).

测试hyperledger restfulAPI地址
172.17.22.39 CA


172.17.22.42 peer 两个
172.17.22.43 peer 两个

第一步：安装依赖包并构建
npm install npm bower grunt-cli graceful-fs@4.1.5 minimatch@3.0.2 -g
npm install grunt grunt-auto-install grunt-contrib-uglify grunt-contrib-copy
npm install express
npm install dot
npm install socket.io
npm install Chart.js
grunt

如果忘记装了某个依赖包，重新装好后，记得要重新执行命令grunt

第二步：运行explorer项目，记得后面不要加空格，不然会报错
set HTTP_PORT=9090
set HYP_REST_ENDPOINT=http://172.17.21.190:7050
node exp-server.js

或者
set HTTP_PORT=9090
set HYP_REST_ENDPOINT=http://172.17.22.42:7050
node exp-server.js

