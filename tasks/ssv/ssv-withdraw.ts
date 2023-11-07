import { task } from 'hardhat/config'
import ssvKeyData from '../data/ssv_key.json'
import ssvClusterData from '../data/ssv_cluster.json'

task('ssv-withdraw', 'SSV Withdraw').setAction(async function (params, { ethers, network, deployments }) {
  const slpDeposit = await ethers.getContractAt('SLPDeposit', (await deployments.get('SLPDeposit')).address)
  let { payload } = ssvKeyData
  let { operatorIds, sharesData } = payload
  let cluster = ssvClusterData.cluster
  const amount = 100
  const to = '0x976Cf43c894BA43cf096DA8C1427f6a51b724BB9'
  const tx = await slpDeposit.withdrawSSV(operatorIds, cluster, to, amount)
  console.log(tx.hash)
})
