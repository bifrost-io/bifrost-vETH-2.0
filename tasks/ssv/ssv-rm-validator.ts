import { task } from 'hardhat/config'
import ssvKeyData from '../data/ssv_key.json'
import ssvClusterData from '../data/ssv_cluster.json'

task('ssv-rm-validator', 'SSV Remove Validator').setAction(async function (params, { ethers, network, deployments }) {
  const slpDeposit = await ethers.getContractAt('SLPDeposit', (await deployments.get('SLPDeposit')).address)
  let { payload } = ssvKeyData
  let { operatorIds, sharesData } = payload
  let cluster = ssvClusterData.cluster
  const tx = await slpDeposit.removeValidatorSSV(payload.publicKey, operatorIds, cluster)
  console.log(tx.hash)
})
