import { task } from 'hardhat/config'
import depositDataList from '../data/deposit_data_ssv.json'
import ssvKeyData from '../data/ssv_key.json'
import ssvClusterData from '../data/ssv_cluster.json'

task('ssv-deposit', 'SSV Deposit').setAction(async function (params, { ethers, network, deployments }) {
  const slpDeposit = await ethers.getContractAt('SLPDeposit', (await deployments.get('SLPDeposit')).address)

  const allValidators = depositDataList.map((item) => [
    `0x${item.pubkey}`,
    `0x${item.withdrawal_credentials}`,
    `0x${item.signature}`,
    `0x${item.deposit_data_root}`,
  ])
  const validators = allValidators.slice(0, 1)
  const amount = 0
  let { payload } = ssvKeyData
  let { operatorIds, sharesData } = payload
  let cluster = ssvClusterData.cluster

  if (validators[0][0] !== payload.publicKey) {
    console.log('publicKey not match')
    return
  }

  console.log(validators[0][0], operatorIds, sharesData, amount, cluster)
  const tx = await slpDeposit.depositSSV(validators[0], operatorIds, sharesData, amount, cluster)
  console.log(tx.hash)
})
