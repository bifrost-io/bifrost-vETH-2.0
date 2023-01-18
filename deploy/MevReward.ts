import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { ethers } from 'hardhat'

const deployFunction: DeployFunction = async function ({ deployments, getNamedAccounts }: HardhatRuntimeEnvironment) {
  console.log('Running MevReward deploy script')

  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  const feeRate = 100n
  const rewardReceiver = ethers.constants.AddressZero

  const { address } = await deploy('MevReward', {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    proxy: {
      proxyContract: 'OpenZeppelinTransparentProxy',
      execute: {
        init: {
          methodName: 'initialize',
          args: [feeRate, rewardReceiver],
        },
      },
    },
  })

  console.log('MevReward deployed at', address)
}

export default deployFunction

deployFunction.dependencies = []

deployFunction.tags = ['MevReward']
