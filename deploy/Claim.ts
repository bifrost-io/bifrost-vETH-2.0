import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { ethers } from 'hardhat'

const deployFunction: DeployFunction = async function ({ deployments, getNamedAccounts }: HardhatRuntimeEnvironment) {
  console.log('Running Claim deploy script')

  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  const vETH2 = (await deployments.get('vETH2')).address
  const merkleRoot = ethers.constants.HashZero

  const { address } = await deploy('Claim', {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    proxy: {
      proxyContract: 'OpenZeppelinTransparentProxy',
      execute: {
        init: {
          methodName: 'initialize',
          args: [vETH2, merkleRoot],
        },
      },
    },
  })

  console.log('Claim deployed at', address)
}

export default deployFunction

deployFunction.dependencies = ['vETH2']

deployFunction.tags = ['Claim']
