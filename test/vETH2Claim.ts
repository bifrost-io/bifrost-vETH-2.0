import { ethers } from 'hardhat'
import { expect } from 'chai'
import { Contract } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { MerkleTree } from 'merkletreejs'

describe('vETH2Claim', function () {
  let vETH2Claim: Contract
  let vETH2: Contract
  let deployer: SignerWithAddress
  let newOwner: SignerWithAddress
  let receiver: SignerWithAddress
  let merkleRoot: string
  let proof: string[]

  before(async function () {
    ;[deployer, newOwner, receiver] = await ethers.getSigners()

    const addressList = []
    for (let i = 0; i < 100; i++) {
      addressList.push(ethers.Wallet.createRandom().address)
    }
    addressList.splice(0, 0, receiver.address)
    const leaves = addressList.map((addr) =>
      ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256'], [addr, ethers.utils.parseEther('1')])
      )
    )
    const tree = new MerkleTree(leaves, ethers.utils.keccak256, { sortPairs: true })
    merkleRoot = tree.getHexRoot()
    proof = tree.getHexProof(tree.getLeaves()[0])
  })

  beforeEach(async function () {
    const VETH2Claim = await ethers.getContractFactory('vETH2Claim')
    const VETH2 = await ethers.getContractFactory('vETH2')
    vETH2Claim = await VETH2Claim.deploy()
    vETH2 = await VETH2.deploy()

    await vETH2Claim.initialize(vETH2.address, merkleRoot)
    await vETH2.mint(vETH2Claim.address, ethers.utils.parseEther('10'))
  })

  it('basic check', async function () {
    expect(await vETH2Claim.vETH2()).to.equal(vETH2.address)
    expect(await vETH2Claim.merkleRoot()).to.equal(merkleRoot)
    expect(await vETH2.balanceOf(vETH2Claim.address)).to.equal(ethers.utils.parseEther('10'))
    expect(await vETH2.totalSupply()).to.equal(ethers.utils.parseEther('10'))
  })

  it('transfer owner should be ok', async function () {
    await vETH2Claim.transferOwnership(newOwner.address)
    expect(await vETH2Claim.owner()).to.equal(newOwner.address)
  })

  it('claim should be ok', async function () {
    const amount = ethers.utils.parseEther('1')
    expect(await vETH2Claim.claimed(receiver.address)).to.equal(false)
    await expect(vETH2Claim.connect(receiver).claim(amount, proof))
      .to.emit(vETH2Claim, 'Claimed')
      .withArgs(receiver.address, amount)
    expect(await vETH2.balanceOf(receiver.address)).to.equal(amount)
    expect(await vETH2Claim.claimed(receiver.address)).to.equal(true)
  })

  it('re-claim should be revert', async function () {
    const amount = ethers.utils.parseEther('1')
    await expect(vETH2Claim.connect(receiver).claim(amount, proof))
      .to.emit(vETH2Claim, 'Claimed')
      .withArgs(receiver.address, amount)
    await expect(vETH2Claim.connect(receiver).claim(amount, proof)).to.revertedWith('Claimed')
  })

  it('claim with wrong proof should be revert', async function () {
    const amount = ethers.utils.parseEther('10')
    await expect(vETH2Claim.connect(receiver).claim(amount, [])).to.revertedWith('Merkle proof verification failed')
  })
})
