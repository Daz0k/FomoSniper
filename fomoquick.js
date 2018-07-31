const Web3 = require('web3');
const FomoQuickABI = require('./fomoquick.sol.json') // ABI as copied from Etherscan
const FomoQuick = '0x4e8ecF79AdE5e2C49B9e30D795517A81e0Bf00B8' // Address of FomoQuick contract

const web3 = new Web3(new Web3.providers.WebsocketProvider('ws://127.0.0.1:12345'))
const me = '' // Your address
const privateKey = '' // Your private key
const toWei = (eth, decimals) => new BigNumber(String(eth)).times(new BigNumber(10 ** decimals)).floor()
web3.eth.accounts.wallet.add(privateKey)

function callback (error, result) {
  console.log(error, result)
}

function getNow() {
  return (new Date()).toLocaleString()
}

const FomoQuickContract = new web3.eth.Contract(FomoQuickABI, FomoQuick)

function checkTime() {
	return FomoQuickContract.methods.getTimeLeft().call()
}

function getKeyPrice() {
  return FomoQuickContract.methods.getBuyPrice().call()
}

function getNonce() {
  return web3.eth.getTransactionCount(me)
}


function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const affCode = 1
const team = 0
const buyKey = (amount, nonce) => async () => {
  const keyPrice = await getKeyPrice()
  const data = FomoQuickContract.methods.buyXid.apply(this, [affCode, team]).encodeABI()
  const signed = await web3.eth.accounts.signTransaction(
    {
      nonce: String(nonce),
      chainId: '1',
      to: FomoQuick,
      data: data,
      value: Math.round(keyPrice * amount),
      gas: '500000',
      gasPrice: toWei(0.000000005, 18)
    },
    privateKey)
  web3.eth.sendSignedTransaction(signed.rawTransaction, (err, res) => console.log(`${getNow()} - buying key! ${res}`))
}


class Quicky {
  constructor () {
    this._buyTimeout = null
  }

  async onBlock () {
    const info = await FomoQuickContract.methods.getCurrentRoundInfo().call()
    const currentWinner = info['7']
    const timeLeft = await checkTime()
    console.log(`${getNow()} - ${timeLeft}s until contract drains. Current winner is ${currentWinner}`)
  }

  async onBuy (error, event) {
    const keysBought = event.returnValues.keysBought / 10**18
    if (keysBought < 1.0) {
      console.log(`${getNow()} - less than 1 key was bought, keep current timer.`)
      return
    }

    const info = await FomoQuickContract.methods.getCurrentRoundInfo().call()
    const currentWinner = info['7']
    const buyer = event.returnValues.playerAddress
    if (currentWinner.toLowerCase() === me.toLowerCase() || buyer.toLowerCase() === me.toLowerCase()) {
      clearTimeout(this._buyTimeout)
      console.log(`${getNow()} - already winning, dont fuck up for yourself`)
      return
    }

    if (this._buyTimeout) {
      clearTimeout(this._buyTimeout)
    }

    const blockNumber = event.blockNumber
    const block = await web3.eth.getBlock(blockNumber)
    const drainingAt = (block.timestamp + 300)*1000
    const millisUntilBuy = drainingAt - Date.now() - 40*1000

    if (millisUntilBuy < 0) {
      return
    }

    const nonce = await getNonce()
    this._buyTimeout = setTimeout(buyKey(1.02, nonce), millisUntilBuy)
    console.log(`${getNow()} - ${buyer} bought a key! Setting timeout to ${new Date(Date.now() + millisUntilBuy).toLocaleString()} - draining at ${new Date(drainingAt).toLocaleString()}`)
  }
}

const quickSniper = new Quicky()
console.log(quickSniper)
web3.eth.subscribe('syncing', () => console.log('Done syncing!'))

const eventOptions = {fromBlock: 'latest'}
FomoQuickContract.events.onEndTx(eventOptions, quickSniper.onBuy)

// If any of these events occur, a new round is starting and we're thus buying a key
async function icoBuy() {
  const nonce = await getNonce()
  buyKey(5, nonce)()
  console.log('Ico buy!')
}
FomoQuickContract.events.onWithdrawAndDistribute(eventOptions, icoBuy)
FomoQuickContract.events.onBuyAndDistribute(eventOptions, icoBuy)
FomoQuickContract.events.onReLoadAndDistribute(eventOptions, icoBuy)


async function quickBuy() {
  // Buys when program starts
  const nonce = await getNonce()
  buyKey(1.01, nonce)()
  console.log('Quickbuy!')
}

//quickBuy()
