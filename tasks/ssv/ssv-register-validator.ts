import { task } from 'hardhat/config'
import ssvKeyData from '../data/ssv_key.json'
import ssvClusterData from '../data/ssv_cluster.json'
import depositDataList from '../data/deposit_data_ssv.json'

task('ssv-register-validator', 'SSV Register Validator').setAction(async function (
  params,
  { ethers, network, deployments }
) {
  const slpDeposit = await ethers.getContractAt('SLPDeposit', (await deployments.get('SLPDeposit')).address)

  const allValidators = depositDataList.map((item) => [
    `0x${item.pubkey}`,
    `0x${item.withdrawal_credentials}`,
    `0x${item.signature}`,
    `0x${item.deposit_data_root}`,
  ])
  const validators = allValidators.slice(0, 1)

  let { payload } = ssvKeyData
  let { operatorIds, sharesData } = payload
  let cluster = ssvClusterData.cluster

  if (validators[0][0] !== payload.publicKey) {
    console.log('publicKey not match')
    return
  }

  const amount = 0
  console.log(payload.publicKey, operatorIds, sharesData, amount, cluster)
  const tx = await slpDeposit.registerValidatorSSV(payload.publicKey, operatorIds, sharesData, amount, cluster)
  console.log(tx.hash)
})
