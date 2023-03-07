import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

const deployFunction: DeployFunction = async function ({ deployments, getNamedAccounts }: HardhatRuntimeEnvironment) {
  console.log('Running MevReward deploy script')

  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  const slpDeposit = (await deployments.get('SLPDeposit')).address

  const { address } = await deploy('MevReward', {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    proxy: {
      proxyContract: 'OpenZeppelinTransparentProxy',
      execute: {
        init: {
          methodName: 'initialize',
          args: [slpDeposit],
        },
      },
    },
  })

  console.log('MevReward deployed at', address)
}

export default deployFunction

deployFunction.dependencies = ['SLPDeposit']

deployFunction.tags = ['MevReward']
