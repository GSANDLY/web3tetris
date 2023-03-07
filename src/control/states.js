import { List } from 'immutable';
import Web3 from 'web3';
import store from '../store';
import { want, isClear, isOver } from '../unit/';
import actions from '../actions';
import { speeds, blankLine, blankMatrix, clearPoints, eachLines } from '../unit/const';
import { music } from '../unit/music';


const getStartMatrix = (startLines) => { // 生成startLines
  const getLine = (min, max) => { // 返回标亮个数在min~max之间一行方块, (包含边界)
    const count = parseInt((((max - min) + 1) * Math.random()) + min, 10);
    const line = [];
    for (let i = 0; i < count; i++) { // 插入高亮
      line.push(1);
    }
    for (let i = 0, len = 10 - count; i < len; i++) { // 在随机位置插入灰色
      const index = parseInt(((line.length + 1) * Math.random()), 10);
      line.splice(index, 0, 0);
    }

    return List(line);
  };
  let startMatrix = List([]);

  for (let i = 0; i < startLines; i++) {
    if (i <= 2) { // 0-3
      startMatrix = startMatrix.push(getLine(5, 8));
    } else if (i <= 6) { // 4-6
      startMatrix = startMatrix.push(getLine(4, 9));
    } else { // 7-9
      startMatrix = startMatrix.push(getLine(3, 9));
    }
  }
  for (let i = 0, len = 20 - startLines; i < len; i++) { // 插入上部分的灰色
    startMatrix = startMatrix.unshift(List(blankLine));
  }
  return startMatrix;
};

const states = {
  // 自动下落setTimeout变量
  fallInterval: null,

  scoreList: [],

  // 游戏开始
  start: () => {
    if (music.start) {
      music.start();
    }
    const state = store.getState();
    states.dispatchPoints(0);
    store.dispatch(actions.speedRun(state.get('speedStart')));
    const startLines = state.get('startLines');
    const startMatrix = getStartMatrix(startLines);
    store.dispatch(actions.matrix(startMatrix));
    store.dispatch(actions.moveBlock({ type: state.get('next') }));
    store.dispatch(actions.nextBlock());
    states.auto();
  },

  // 自动下落
  auto: (timeout) => {
    const out = (timeout < 0 ? 0 : timeout);
    let state = store.getState();
    let cur = state.get('cur');
    const fall = () => {
      state = store.getState();
      cur = state.get('cur');
      const next = cur.fall();
      if (want(next, state.get('matrix'))) {
        store.dispatch(actions.moveBlock(next));
        states.fallInterval = setTimeout(fall, speeds[state.get('speedRun') - 1]);
      } else {
        let matrix = state.get('matrix');
        const shape = cur && cur.shape;
        const xy = cur && cur.xy;
        shape.forEach((m, k1) => (
          m.forEach((n, k2) => {
            if (n && xy.get(0) + k1 >= 0) { // 竖坐标可以为负
              let line = matrix.get(xy.get(0) + k1);
              line = line.set(xy.get(1) + k2, 1);
              matrix = matrix.set(xy.get(0) + k1, line);
            }
          })
        ));
        states.nextAround(matrix);
      }
    };
    clearTimeout(states.fallInterval);
    states.fallInterval = setTimeout(fall,
      out === undefined ? speeds[state.get('speedRun') - 1] : out);
  },

  // /////// 测试给小狐狸添加网络 /////////////
  addNetworkToMetaMask: () => {
    const rpc1 = 'https://myflashlayerf55e6719-alt-producer-rpc.alt.technology';
    const explorerUrl = 'https://explorer.alt.technology?rpcUrl=https://myflashlayerf55e6719-alt-producer-rpc.alt.technology';
    if (window.ethereum.networkVersion === '1000028') {
      return;
    }
    window.ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: 1000028,
          chainName: 'myflashlayer',
          nativeCurrency: {
            name: 'Coin',
            symbol: 'COIN', // 2-6 characters long
            decimals: 18,
          },
          rpcUrls: [rpc1],
          blockExplorerUrls: [explorerUrl],
        },
      ],
    }).then((res) => {
          // 添加成功
      console.info(`添加成功!!!!!!!!!!!!!!! ${res}`);
    }).catch((err) => {
          // 添加失败
      console.info(`添加失败 ${err} !!!!!!!!!!!!!!!!!!!!!!!!!`);
    });
  },

  // 每轮游戏结束后，把“地址｜分数”写入合约
  writeScoreToContract: (point) => {
    // ///////////// 小狐狸请求访问钱包地址 ///////////////////////
    window.ethereum.request({
      method: 'eth_requestAccounts',
    }).then((accounts) => {
      window.userWalletAddress = accounts[0];

      // 4. store the user's wallet address in local storage
      window.localStorage.setItem('userWalletAddress', accounts[0]);

      // //////// 测试调用写入合约 ///////////////
      const myContractAddr = '0x3627e85Ddc84324b46bAdC02A621FFb487A3cAb8';
      const web3 = new Web3(window.ethereum);
      const ins = [{
        type: 'function',
        name: 'store',
        constant: false,
        payable: false,
        stateMutability: 'nonpayable',
        inputs: [{ name: 'num', type: 'uint256' }],
        outputs: [],
      }, {
        type: 'function',
        name: 'retrieve',
        constant: false,
        payable: false,
        stateMutability: 'nonpayable',
        inputs: [],
        outputs: [{ name: 'number', type: 'uint256' }],
      }, {
        type: 'function',
        name: 'submiteScore',
        constant: false,
        payable: false,
        stateMutability: 'nonpayable',
        inputs: [{ name: 'score', type: 'string' }],
        outputs: [],
      }, {
        type: 'function',
        name: 'getScoreList',
        constant: false,
        payable: false,
        stateMutability: 'nonpayable',
        inputs: [],
        outputs: [{ name: 'scoreList', type: 'string[]' }],
      }];
      const myContract = new web3.eth.Contract(ins, myContractAddr);
      myContract.methods.submiteScore(`${window.userWalletAddress}|${point}`).send({
        from: window.userWalletAddress,
      }).then(() => {
        myContract.methods.getScoreList().call().then(rs => {
          console.log(rs);
        });
      });
      // //////// 测试调用写入合约 ///////////////
    })
    .catch(() => {
      // 2.1 if the user cancels the login prompt
      throw Error('Please select an account');
    });
  },

  // 读取游戏分数排行榜
  readScoreList: () => {
    // ///////////// 小狐狸请求访问钱包地址 ///////////////////////
    window.ethereum.request({
      method: 'eth_requestAccounts',
    }).then((accounts) => {
      window.userWalletAddress = accounts[0];

      // 4. store the user's wallet address in local storage
      window.localStorage.setItem('userWalletAddress', accounts[0]);

      // //////// 测试调用写入合约 ///////////////
      const myContractAddr = '0x3627e85Ddc84324b46bAdC02A621FFb487A3cAb8';
      const web3 = new Web3(window.ethereum);
      const ins = [{
        type: 'function',
        name: 'store',
        constant: false,
        payable: false,
        stateMutability: 'nonpayable',
        inputs: [{ name: 'num', type: 'uint256' }],
        outputs: [],
      }, {
        type: 'function',
        name: 'retrieve',
        constant: false,
        payable: false,
        stateMutability: 'nonpayable',
        inputs: [],
        outputs: [{ name: 'number', type: 'uint256' }],
      }, {
        type: 'function',
        name: 'submiteScore',
        constant: false,
        payable: false,
        stateMutability: 'nonpayable',
        inputs: [{ name: 'score', type: 'string' }],
        outputs: [],
      }, {
        type: 'function',
        name: 'getScoreList',
        constant: false,
        payable: false,
        stateMutability: 'nonpayable',
        inputs: [],
        outputs: [{ name: 'scoreList', type: 'string[]' }],
      }];
      const myContract = new web3.eth.Contract(ins, myContractAddr);
      myContract.methods.getScoreList().call().then(rs => {
        const newArrForSort = [...rs];
        newArrForSort.sort((a, b) => {
          const aScore = window.parseInt(a.substring(a.indexOf('|') + 1));
          const bScore = window.parseInt(b.substring(b.indexOf('|') + 1));
          return bScore - aScore;
        });
        states.scoreList = newArrForSort.slice(0, 10);
      });
      // //////// 测试调用写入合约 ///////////////
    })
    .catch(() => {
      // 2.1 if the user cancels the login prompt
      throw Error('Please select an account');
    });
  },

  // 一个方块结束, 触发下一个
  nextAround: (matrix, stopDownTrigger) => {
    clearTimeout(states.fallInterval);
    store.dispatch(actions.lock(true));
    store.dispatch(actions.matrix(matrix));
    if (typeof stopDownTrigger === 'function') {
      stopDownTrigger();
    }

    const addPoints = (store.getState().get('points') + 10) +
      ((store.getState().get('speedRun') - 1) * 2); // 速度越快, 得分越高

    states.dispatchPoints(addPoints);

    if (isClear(matrix)) {
      if (music.clear) {
        music.clear();
      }
      return;
    }
    if (isOver(matrix)) {
      if (music.gameover) {
        music.gameover();
      }
      states.overStart();
      states.writeScoreToContract(addPoints);
      return;
    }
    setTimeout(() => {
      store.dispatch(actions.lock(false));
      store.dispatch(actions.moveBlock({ type: store.getState().get('next') }));
      store.dispatch(actions.nextBlock());
      states.auto();
    }, 100);
  },

  // 页面焦点变换
  focus: (isFocus) => {
    store.dispatch(actions.focus(isFocus));
    if (!isFocus) {
      clearTimeout(states.fallInterval);
      return;
    }
    const state = store.getState();
    if (state.get('cur') && !state.get('reset') && !state.get('pause')) {
      states.auto();
    }
  },

  // 暂停
  pause: (isPause) => {
    store.dispatch(actions.pause(isPause));
    if (isPause) {
      clearTimeout(states.fallInterval);
      return;
    }
    states.auto();
  },

  // 消除行
  clearLines: (matrix, lines) => {
    const state = store.getState();
    let newMatrix = matrix;
    lines.forEach(n => {
      newMatrix = newMatrix.splice(n, 1);
      newMatrix = newMatrix.unshift(List(blankLine));
    });
    store.dispatch(actions.matrix(newMatrix));
    store.dispatch(actions.moveBlock({ type: state.get('next') }));
    store.dispatch(actions.nextBlock());
    states.auto();
    store.dispatch(actions.lock(false));
    const clearLines = state.get('clearLines') + lines.length;
    store.dispatch(actions.clearLines(clearLines)); // 更新消除行

    const addPoints = store.getState().get('points') +
      clearPoints[lines.length - 1]; // 一次消除的行越多, 加分越多
    states.dispatchPoints(addPoints);

    const speedAdd = Math.floor(clearLines / eachLines); // 消除行数, 增加对应速度
    let speedNow = state.get('speedStart') + speedAdd;
    speedNow = speedNow > 6 ? 6 : speedNow;
    store.dispatch(actions.speedRun(speedNow));
  },

  // 游戏结束, 触发动画
  overStart: () => {
    clearTimeout(states.fallInterval);
    store.dispatch(actions.lock(true));
    store.dispatch(actions.reset(true));
    store.dispatch(actions.pause(false));
  },

  // 游戏结束动画完成
  overEnd: () => {
    store.dispatch(actions.matrix(blankMatrix));
    store.dispatch(actions.moveBlock({ reset: true }));
    store.dispatch(actions.reset(false));
    store.dispatch(actions.lock(false));
    store.dispatch(actions.clearLines(0));
  },

  // 写入分数
  dispatchPoints: (point) => { // 写入分数, 同时判断是否创造最高分
    store.dispatch(actions.points(point));
    if (point > 0 && point > store.getState().get('max')) {
      store.dispatch(actions.max(point));
    }
  },
};

export default states;
