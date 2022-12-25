import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

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

  console.log('SLPDeposit deployed at', address)
}

export default deployFunction

deployFunction.dependencies = ['DepositContract']

deployFunction.tags = ['SLPDeposit']
