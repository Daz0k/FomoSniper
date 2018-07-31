// MADE BY KEKAKEK
// COMMENT AT BOTTOM TO PREVENT BUYING A KEY ON PROGRAM LAUNCH

const Web3 = require('web3');
const BigNumber = require('bignumber.js')

const FomoQuickABI = require('./fomoquick.sol.json') // ABI as copied from Etherscan
const FomoQuick = '0x4e8ecF79AdE5e2C49B9e30D795517A81e0Bf00B8' // Address of FomoQuick contract

// Get a nice provider. You need WebSocket for event listening, so get that with a local geth node
// Run geth like this: './geth --light --ws --wsorigins="*" --wsport 12345
const web3 = new Web3(new Web3.providers.WebsocketProvider('ws://127.0.0.1:12345'))

// FILL INN HERE
const me = '0x'
const privateKey = '0x' // Your private key

// Add wallet to accounts
web3.eth.accounts.wallet.add(privateKey)

// Some helper functions
const toWei = (eth, decimals) => Math.floor(new BigNumber(String(eth)).multipliedBy(new BigNumber(10 ** decimals)))

function getNow() {
  return (new Date()).toLocaleString()
}


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

// Fill inn your preferences. Bad advice to Justo here
const affCode = 1 // Justos affCode
const team = 0
// Code for buying key
const buyKey = (amount, nonce) => async () => {
  const keyPrice = await getKeyPrice()

  // Get data as defined by smart contract interface
  const data = FomoQuickContract.methods.buyXid.apply(this, [affCode, team]).encodeABI()

  // Signed TX
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

  // Send send send!
  web3.eth.sendSignedTransaction(signed.rawTransaction, (err, res) => console.log(`${getNow()} - buying key! ${res}`))
}


class Quicky {
  constructor () {
    this._buyTimeout = null
  }

  async onBlock () {
    // On block, nothing fancy
    const info = await FomoQuickContract.methods.getCurrentRoundInfo().call()
    const currentWinner = info['7']
    const timeLeft = await checkTime()
    console.log(`${getNow()} - ${timeLeft}s until contract drains. Current winner is ${currentWinner}`)
  }

  async onBuy (error, event) {
    // Abort if a micro key was bought
    const keysBought = event.returnValues.keysBought / 10**18
    if (keysBought < 1.0) {
      console.log(`${getNow()} - less than 1 key was bought, keep current timer.`)
      return
    }

    // Get info about winner
    const info = await FomoQuickContract.methods.getCurrentRoundInfo().call()
    const currentWinner = info['7']
    const buyer = event.returnValues.playerAddress

    // Dont buy if youre already going to win
    if (currentWinner.toLowerCase() === me.toLowerCase() || buyer.toLowerCase() === me.toLowerCase()) {
      clearTimeout(this._buyTimeout)
      console.log(`${getNow()} - already winning, dont fuck up for yourself`)
      return
    }

    if (this._buyTimeout) {
      // Clear current buyTimeout if its set
      clearTimeout(this._buyTimeout)
    }

    // Get blocknumber and check timestamp of block
    const blockNumber = event.blockNumber
    const block = await web3.eth.getBlock(blockNumber)

    // Calculate points in time
    const drainingAt = (block.timestamp + 300)*1000
    const buyMillisBeforeEnd = 30*1000 // Send buy tx 30s before contract drains
    const millisUntilBuy = drainingAt - Date.now() - buyMillisBeforeEnd

    // If its a thing of the past
    if (millisUntilBuy < 0) {
      return
    }

    // Set nonce when queueing buy function to save time
    const nonce = await getNonce()
    this._buyTimeout = setTimeout(buyKey(1.02, nonce), millisUntilBuy)
    console.log(`${getNow()} - ${buyer} bought a key! Setting timeout to ${new Date(Date.now() + millisUntilBuy).toLocaleString()} - draining at ${new Date(drainingAt).toLocaleString()}`)
  }
}

// Create contract object, lovely
const FomoQuickContract = new web3.eth.Contract(FomoQuickABI, FomoQuick)

// QuickSniper object
const quickSniper = new Quicky()
console.log(quickSniper)

// If any of these events occur, a new round is starting and we're thus buying a key
async function icoBuy() {
  const nonce = await getNonce()
  buyKey(5, nonce)()
  console.log('Ico buy!')
}
// Only get new block on start!
const eventOptions = {fromBlock: 'latest'}
FomoQuickContract.events.onEndTx(eventOptions, quickSniper.onBuy) // Queue up a buy if someone buys a key
web3.eth.subscribe('syncing', () => console.log('Done syncing!'))

// ICO buy
FomoQuickContract.events.onWithdrawAndDistribute(eventOptions, icoBuy)
FomoQuickContract.events.onBuyAndDistribute(eventOptions, icoBuy)
FomoQuickContract.events.onReLoadAndDistribute(eventOptions, icoBuy)


async function quickBuy() {
  // Buys when program starts
  const nonce = await getNonce()
  buyKey(1.01, nonce)()
  console.log('Quickbuy!')
}

// COMMENT IF YOU DONT WANT TO BUY WHEN PROGRAM START
quickBuy()
