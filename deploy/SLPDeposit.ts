import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { ethers } from 'hardhat'

const deployFunction: DeployFunction = async function ({ deployments, getNamedAccounts }: HardhatRuntimeEnvironment) {
  console.log('Running SLPDeposit deploy script')

  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  const depositContract = (await deployments.get('DepositContract')).address

  const { address } = await deploy('SLPDeposit', {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    proxy: {
      proxyContract: 'OpenZeppelinTransparentProxy',
      execute: {
        init: {
          methodName: 'initialize',
          args: [depositContract],
        },
      },
    },
  })

  const slpDeposit = await ethers.getContractAt('SLPDeposit', address)
  const index = 0
  const merkleRoot = '0xd68ce67b1e69f61353fd887b267493c2f1401f9711c0c2b1744bbe8cbf27938f'
  await slpDeposit.setMerkleRoot(index, merkleRoot)
  console.log('\x1b[32m%s\x1b[0m', `Merkle root at index 0 is ${await slpDeposit.merkleRoots(index)}`)

  console.log('SLPDeposit deployed at', address)
}

export default deployFunction

deployFunction.dependencies = ['DepositContract']

deployFunction.tags = ['SLPDeposit']
