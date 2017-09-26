
**Note:** This is a **read-only mirror** of the formal [Gerrit](https://gerrit.hyperledger.org/r/#/admin/projects/blockchain-explorer) repository,
where active development is ongoing. Issue tracking is handled in [Jira](https://jira.hyperledger.org/secure/RapidBoard.jspa?projectKey=FAB&rapidView=5&view=planning)

## Incubation Notice

This project is a Hyperledger project in _Incubation_. It was proposed to the
community and documented [here](https://docs.google.com/document/d/1Z8uR_w9E9XITEe88PzkLjzH9t5bPivUhQO8OiEP7s_U/edit). 
Information on what _Incubation_ entails can be found in the [Hyperledger Project Lifecycle
document](https://goo.gl/4edNRc).

����hyperledger restfulAPI��ַ
172.17.22.39 CA


172.17.22.42 peer ����
172.17.22.43 peer ����

��һ������װ������������
npm install npm bower grunt-cli graceful-fs@4.1.5 minimatch@3.0.2 -g
npm install grunt grunt-auto-install grunt-contrib-uglify grunt-contrib-copy
npm install express
npm install dot
npm install socket.io
npm install Chart.js
grunt

�������װ��ĳ��������������װ�ú󣬼ǵ�Ҫ����ִ������grunt

�ڶ���������explorer��Ŀ���ǵú��治Ҫ�ӿո񣬲�Ȼ�ᱨ��
set HTTP_PORT=9090
set HYP_REST_ENDPOINT=http://172.17.21.190:7050
node exp-server.js

����
set HTTP_PORT=9090
set HYP_REST_ENDPOINT=http://172.17.22.42:7050
node exp-server.js

