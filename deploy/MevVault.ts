import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

const deployFunction: DeployFunction = async function ({ deployments, getNamedAccounts }: HardhatRuntimeEnvironment) {
  console.log('Running MevVault deploy script')

  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  const slpCore = (await deployments.get('SLPCore')).address
  const slpDeposit = (await deployments.get('SLPDeposit')).address

  const { address } = await deploy('MevVault', {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    proxy: {
      proxyContract: 'OpenZeppelinTransparentProxy',
      execute: {
        init: {
          methodName: 'initialize',
          args: [slpCore, slpDeposit],
        },
      },
    },
  })

  console.log('MevVault deployed at', address)
}

export default deployFunction

deployFunction.dependencies = ['SLPCore', 'SLPDeposit']

deployFunction.tags = ['MevVault']
