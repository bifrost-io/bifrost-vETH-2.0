import { task } from 'hardhat/config'

task('set-merkle-root', 'Set merkle root').setAction(async function (
  params: { id: number },
  { ethers, network, deployments }
) {
  const vETH2Claim = await ethers.getContractAt('vETH2Claim', (await deployments.get('vETH2Claim')).address)
  const tx = await vETH2Claim.setMerkleRoot('0xeb36b5939e6cf00a2b16feee44abdd87f4ab319176fabe6eb829eeaf27c1814f')

  console.log(`Merkle root set: ${tx.hash}`)
})
